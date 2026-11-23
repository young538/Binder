import 'server-only';
import zlib from 'node:zlib';
import iconv from 'iconv-lite';
import { FinanceImportError, MAX_FINANCE_UPLOAD_BYTES } from './parser';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32Step(crc: number, byteVal: number): number {
  return ((crc >>> 8) ^ CRC32_TABLE[(crc ^ byteVal) & 0xff]) >>> 0;
}

/** Compute IEEE CRC-32 checksum for ZIP integrity verification. */
export function computeCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = crc32Step(crc, buffer[i]);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntryMeta {
  name: string;
  flags: number;
  method: number;
  modTime: number;
  crc32: number;
  compSize: number;
  uncompSize: number;
  localHeaderOffset: number;
  isDirectory: boolean;
}

function decodeZipEntryName(nameBytes: Buffer, flags: number): string {
  if ((flags & 0x800) !== 0) {
    return nameBytes.toString('utf8');
  }
  const utf8 = nameBytes.toString('utf8');
  if (!utf8.includes('\ufffd')) {
    return utf8;
  }
  return iconv.decode(nameBytes, 'cp949');
}

function decryptZipCrypto(payload: Buffer, entry: ZipEntryMeta, password: string): Buffer {
  if (payload.length < 12) {
    throw new FinanceImportError('PARSE_ERROR', '손상된 암호화 ZIP 파일입니다.');
  }

  let key0 = 0x12345678 >>> 0;
  let key1 = 0x23456789 >>> 0;
  let key2 = 0x34567890 >>> 0;

  const updateKeys = (byteVal: number) => {
    key0 = crc32Step(key0, byteVal);
    key1 = (key1 + (key0 & 0xff)) >>> 0;
    key1 = (Math.imul(key1, 0x08088405) + 1) >>> 0;
    key2 = crc32Step(key2, (key1 >>> 24) & 0xff);
  };

  const decryptByte = (): number => {
    const temp = (key2 & 0xffff) | 2;
    return (Math.imul(temp, temp ^ 1) >>> 8) & 0xff;
  };

  const pwBytes = Buffer.from(password, 'utf8');
  for (let i = 0; i < pwBytes.length; i++) {
    updateKeys(pwBytes[i]);
  }

  let lastHeaderByte = 0;
  for (let i = 0; i < 12; i++) {
    const plain = payload[i] ^ decryptByte();
    updateKeys(plain);
    lastHeaderByte = plain;
  }

  const crcCheck = (entry.crc32 >>> 24) & 0xff;
  const timeCheck = (entry.modTime >>> 8) & 0xff;
  const headerValid =
    (entry.flags & 8) !== 0
      ? lastHeaderByte === timeCheck || lastHeaderByte === crcCheck
      : lastHeaderByte === crcCheck;

  if (!headerValid) {
    throw new FinanceImportError(
      'INVALID_PASSWORD',
      '압축 파일 비밀번호가 올바르지 않습니다.',
    );
  }

  const decrypted = Buffer.allocUnsafe(payload.length - 12);
  for (let i = 12; i < payload.length; i++) {
    const plain = payload[i] ^ decryptByte();
    updateKeys(plain);
    decrypted[i - 12] = plain;
  }
  return decrypted;
}

/** Extract the first .xlsx or .csv finance ledger entry from a plain or ZipCrypto ZIP buffer. */
export function extractFinanceEntryFromZip(
  buffer: Buffer,
  password?: string,
  maxUncompressedBytes: number = MAX_FINANCE_UPLOAD_BYTES,
): { entryName: string; buffer: Buffer } {
  if (buffer.length < 22) {
    throw new FinanceImportError('PARSE_ERROR', '유효한 ZIP 파일이 아닙니다.');
  }

  // Scan backwards for End of Central Directory signature (0x06054b50)
  const searchMin = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= searchMin; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      const commentLen = buffer.readUInt16LE(i + 20);
      if (i + 22 + commentLen <= buffer.length) {
        eocdOffset = i;
        break;
      }
    }
  }

  if (eocdOffset === -1) {
    throw new FinanceImportError('PARSE_ERROR', 'ZIP 중앙 디렉터리를 찾을 수 없습니다.');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new FinanceImportError('PARSE_ERROR', 'ZIP64 압축 형식은 지원하지 않습니다.');
  }
  if (cdOffset + cdSize > eocdOffset) {
    throw new FinanceImportError('PARSE_ERROR', '손상된 ZIP 파일입니다.');
  }

  const entries: ZipEntryMeta[] = [];
  let cursor = cdOffset;
  const cdEnd = cdOffset + cdSize;
  while (cursor + 46 <= cdEnd) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new FinanceImportError('PARSE_ERROR', '손상된 ZIP 파일 항목이 있습니다.');
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const modTime = buffer.readUInt16LE(cursor + 12);
    const crc32 = buffer.readUInt32LE(cursor + 16);
    const compSize = buffer.readUInt32LE(cursor + 20);
    const uncompSize = buffer.readUInt32LE(cursor + 24);
    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const externalAttr = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);

    if (cursor + 46 + nameLen + extraLen + commentLen > cdEnd) {
      throw new FinanceImportError('PARSE_ERROR', '손상된 ZIP 디렉터리 길이입니다.');
    }

    const name = decodeZipEntryName(
      buffer.subarray(cursor + 46, cursor + 46 + nameLen),
      flags,
    );
    const isDirectory = name.endsWith('/') || (externalAttr & 0x10) !== 0;

    entries.push({
      name,
      flags,
      method,
      modTime,
      crc32,
      compSize,
      uncompSize,
      localHeaderOffset,
      isDirectory,
    });

    cursor += 46 + nameLen + extraLen + commentLen;
  }

  const visible = entries.filter(
    e => !e.isDirectory && !e.name.startsWith('__MACOSX/') && !e.name.includes('/__MACOSX/'),
  );
  const selected =
    visible.find(e => /\.xlsx$/i.test(e.name)) ??
    visible.find(e => /\.csv$/i.test(e.name));

  if (!selected) {
    throw new FinanceImportError(
      'UNSUPPORTED_FORMAT',
      'ZIP 압축 파일 안에 .xlsx 또는 .csv 가계부 파일이 없습니다.',
    );
  }

  if (selected.uncompSize > maxUncompressedBytes) {
    throw new FinanceImportError('FILE_TOO_LARGE', '파일 크기는 최대 10MB까지 지원합니다.');
  }
  if (selected.localHeaderOffset + 30 > cdOffset) {
    throw new FinanceImportError('PARSE_ERROR', '손상된 ZIP 로컬 헤더 위치입니다.');
  }
  if (buffer.readUInt32LE(selected.localHeaderOffset) !== 0x04034b50) {
    throw new FinanceImportError('PARSE_ERROR', '손상된 ZIP 로컬 파일 헤더입니다.');
  }

  const localNameLen = buffer.readUInt16LE(selected.localHeaderOffset + 26);
  const localExtraLen = buffer.readUInt16LE(selected.localHeaderOffset + 28);
  const dataStart = selected.localHeaderOffset + 30 + localNameLen + localExtraLen;
  const dataEnd = dataStart + selected.compSize;
  if (dataEnd > cdOffset) {
    throw new FinanceImportError('PARSE_ERROR', 'ZIP 압축 데이터 범위를 벗어났습니다.');
  }

  let payload = buffer.subarray(dataStart, dataEnd);
  const isEncrypted = (selected.flags & 1) !== 0;
  if (isEncrypted) {
    if (selected.method === 99) {
      throw new FinanceImportError(
        'UNSUPPORTED_FORMAT',
        'AES 암호화 ZIP 파일은 지원하지 않습니다. 압축을 해제해 .xlsx 파일을 올려 주세요.',
      );
    }
    if (!password) {
      throw new FinanceImportError(
        'PASSWORD_REQUIRED',
        '비밀번호가 설정된 압축 파일입니다. 비밀번호를 입력해 주세요.',
      );
    }
    payload = decryptZipCrypto(payload, selected, password);
  }

  let rawBuffer: Buffer;
  if (selected.method === 0) {
    if (payload.length > maxUncompressedBytes) {
      throw new FinanceImportError('FILE_TOO_LARGE', '파일 크기는 최대 10MB까지 지원합니다.');
    }
    rawBuffer = Buffer.from(payload);
  } else if (selected.method === 8) {
    try {
      rawBuffer = zlib.inflateRawSync(payload, { maxOutputLength: maxUncompressedBytes });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ERR_BUFFER_TOO_LARGE') {
        throw new FinanceImportError('FILE_TOO_LARGE', '파일 크기는 최대 10MB까지 지원합니다.');
      }
      if (isEncrypted) {
        throw new FinanceImportError(
          'INVALID_PASSWORD',
          '압축 파일 비밀번호가 올바르지 않습니다.',
        );
      }
      throw new FinanceImportError('PARSE_ERROR', 'ZIP 압축 해제 중 오류가 발생했습니다.');
    }
  } else {
    throw new FinanceImportError(
      'UNSUPPORTED_FORMAT',
      `지원하지 않는 ZIP 압축 방식(${selected.method})입니다.`,
    );
  }

  const actualCrc = computeCrc32(rawBuffer);
  if (actualCrc !== selected.crc32) {
    if (isEncrypted) {
      throw new FinanceImportError(
        'INVALID_PASSWORD',
        '압축 파일 비밀번호가 올바르지 않습니다.',
      );
    }
    throw new FinanceImportError('PARSE_ERROR', 'ZIP 파일 CRC 검증에 실패했습니다.');
  }

  return {
    entryName: selected.name,
    buffer: rawBuffer,
  };
}

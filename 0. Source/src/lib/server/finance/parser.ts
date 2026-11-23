import 'server-only';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';
import officeCrypto from 'officecrypto-tool';
import {
  buildFinanceRowKey,
  type FinanceImportRow,
} from '@/lib/finance';
import type {
  FinanceTransactionKind,
  FinanceTransactionSource,
  SubscriptionCurrency,
} from '@/lib/types';

export const MAX_FINANCE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_FINANCE_IMPORT_ROWS = 20_000;

export type FinanceImportErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'NO_DATA'
  | 'PARSE_ERROR';

export class FinanceImportError extends Error {
  constructor(
    public readonly code: FinanceImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FinanceImportError';
  }
}

export interface ParsedFinanceFile {
  format: 'banksalad_xlsx' | 'csv';
  sheetName: string | null;
  rows: FinanceImportRow[];
  skippedRows: number;
}

const OLE_CFB_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function unwrapCellValue(raw: ExcelJS.CellValue): unknown {
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return raw;
  if (typeof raw !== 'object') return raw;
  if ('result' in raw && raw.result !== undefined) {
    return unwrapCellValue(raw.result as ExcelJS.CellValue);
  }
  if ('richText' in raw && Array.isArray(raw.richText)) {
    return raw.richText.map(part => part.text ?? '').join('');
  }
  if ('text' in raw && typeof raw.text === 'string') {
    return raw.text;
  }
  return String(raw);
}

function normalizeHeaderName(text: string): string {
  return text.replace(/[\s_*()[\]]+/g, '').toLowerCase();
}

function excelSerialToUtcDate(serial: number): Date {
  // Excel epoch: 1899-12-30 UTC (accounts for Excel's 1900 leap year bug cleanly for modern dates).
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms);
}

function formatUtcIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidIsoDateStr(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso;
}

function parseDateValue(raw: unknown): string | null {
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    const iso = formatUtcIsoDate(raw);
    return isValidIsoDateStr(iso) ? iso : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20_000 && raw < 80_000) {
    const iso = formatUtcIsoDate(excelSerialToUtcDate(raw));
    return isValidIsoDateStr(iso) ? iso : null;
  }
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const isoMatch = text.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (isoMatch) {
    const iso = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    return isValidIsoDateStr(iso) ? iso : null;
  }
  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const iso = `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    return isValidIsoDateStr(iso) ? iso : null;
  }
  return null;
}

function parseTimeValue(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    const hh = String(raw.getUTCHours()).padStart(2, '0');
    const mm = String(raw.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw < 1) {
    const totalMin = Math.round(raw * 24 * 60);
    const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const text = String(raw).trim();
  const m = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function parseAmountValue(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const cleaned = String(raw ?? '')
    .replace(/[\s,₩$€¥원]/g, '')
    .replace(/^\((.+)\)$/, '-$1');
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCurrency(raw: unknown): SubscriptionCurrency {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s || s === 'KRW' || s === '원' || s === '₩') return 'KRW';
  if (s === 'USD' || s === '$' || s === '달러') return 'USD';
  if (s === 'JPY' || s === '¥' || s === '엔') return 'JPY';
  if (s === 'EUR' || s === '€' || s === '유로') return 'EUR';
  return 'KRW';
}

function parseKind(rawType: unknown, rawAmount: number, amountHeader: string): FinanceTransactionKind {
  const s = String(rawType ?? '').trim().toLowerCase();
  if (s.includes('이체') || s === 'transfer') return 'transfer';
  if (s.includes('수입') || s.includes('입금') || s === 'income') return 'income';
  if (s.includes('지출') || s.includes('출금') || s === 'expense') return 'expense';
  if (rawAmount < 0) return 'expense';
  const hdr = normalizeHeaderName(amountHeader);
  if (hdr.includes('이용금액') || hdr.includes('승인금액') || hdr.includes('결제금액') || hdr.includes('출금')) {
    return 'expense';
  }
  return rawAmount > 0 && !s ? 'expense' : 'income';
}

interface ColumnIndices {
  date: number;
  time: number;
  kind: number;
  category: number;
  subCategory: number;
  merchant: number;
  amount: number;
  amountHeader: string;
  currency: number;
  paymentMethod: number;
  note: number;
}

function detectColumns(headers: string[]): ColumnIndices | null {
  const norm = headers.map(h => normalizeHeaderName(h));
  const findCol = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = norm.findIndex(h => h === c);
      if (idx >= 0) return idx;
    }
    for (const c of candidates) {
      const idx = norm.findIndex(h => h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const date = findCol(['날짜', '거래일시', '거래일', '이용일', '승인일', '일자', 'date']);
  const amount = findCol(['금액', '이용금액', '승인금액', '결제금액', '거래금액', 'amount']);
  if (date < 0 || amount < 0) return null;

  return {
    date,
    time: findCol(['시간', '거래시간', '승인시간', 'time']),
    kind: findCol(['타입', '구분', '유형', '거래유형', 'type']),
    category: findCol(['대분류', '카테고리', '분류', 'category']),
    subCategory: findCol(['소분류', '세부분류', 'subcategory']),
    merchant: findCol(['내용', '가맹점', '가맹점명', '거래처', '적요', '내역', '상호', 'merchant']),
    amount,
    amountHeader: headers[amount] ?? '금액',
    currency: findCol(['화폐', '통화', 'currency']),
    paymentMethod: findCol(['결제수단', '결제방법', '카드사', '계좌', '카드', 'paymentmethod']),
    note: findCol(['메모', '비고', 'note']),
  };
}

function finalizeRows(
  rawTableRows: unknown[][],
  cols: ColumnIndices,
  source: FinanceTransactionSource,
): { rows: FinanceImportRow[]; skippedRows: number } {
  const rows: FinanceImportRow[] = [];
  let skippedRows = 0;
  const occurrenceCounter = new Map<string, number>();

  for (const rowValues of rawTableRows) {
    if (rows.length >= MAX_FINANCE_IMPORT_ROWS) {
      skippedRows++;
      continue;
    }

    const date = parseDateValue(rowValues[cols.date]);
    const rawAmount = parseAmountValue(rowValues[cols.amount]);
    if (!date || rawAmount === null || rawAmount === 0) {
      // Skip blank/subtotal lines silently unless they carry text without valid date
      const hasAnyValue = rowValues.some(v => String(v ?? '').trim() !== '');
      if (hasAnyValue) skippedRows++;
      continue;
    }

    const absAmount = Math.round(Math.abs(rawAmount) * 100) / 100;
    const kind = parseKind(cols.kind >= 0 ? rowValues[cols.kind] : '', rawAmount, cols.amountHeader);
    const time = cols.time >= 0 ? parseTimeValue(rowValues[cols.time]) : null;
    const rawCategory = cols.category >= 0 ? String(rowValues[cols.category] ?? '').trim() : '';
    const subCategory = cols.subCategory >= 0 ? String(rowValues[cols.subCategory] ?? '').trim() || null : null;
    const rawMerchant = cols.merchant >= 0 ? String(rowValues[cols.merchant] ?? '').trim() : '';
    const category = rawCategory || (kind === 'income' ? '기타 수입' : kind === 'transfer' ? '이체' : '기타');
    const merchant = rawMerchant || subCategory || category || '내역';
    const currency = cols.currency >= 0 ? parseCurrency(rowValues[cols.currency]) : 'KRW';
    const paymentMethod = cols.paymentMethod >= 0 ? String(rowValues[cols.paymentMethod] ?? '').trim() || null : null;
    const note = cols.note >= 0 ? String(rowValues[cols.note] ?? '').trim() || null : null;

    const baseDraft = {
      date,
      time,
      kind,
      amount: absAmount,
      currency,
      category,
      subCategory,
      merchant,
      paymentMethod,
      note,
      source,
    };
    const baseKey = buildFinanceRowKey(baseDraft, 0);
    const occurrence = occurrenceCounter.get(baseKey) ?? 0;
    occurrenceCounter.set(baseKey, occurrence + 1);

    const canonical = buildFinanceRowKey(baseDraft, occurrence);
    const externalHash = createHash('sha256').update(canonical).digest('hex');

    rows.push({
      ...baseDraft,
      externalHash,
    });
  }

  return { rows, skippedRows };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  const utf8 = buffer.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return iconv.decode(buffer, 'cp949');
}

function parseCsvBuffer(buffer: Buffer): ParsedFinanceFile {
  const text = decodeCsvBuffer(buffer).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = text
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.trim().length > 0);

  if (rawLines.length < 2) {
    throw new FinanceImportError('NO_DATA', 'CSV 파일에서 헤더와 데이터 행을 찾지 못했습니다.');
  }

  let headerIdx = -1;
  let cols: ColumnIndices | null = null;
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const parsed = splitCsvLine(rawLines[i]);
    const detected = detectColumns(parsed);
    if (detected) {
      headerIdx = i;
      cols = detected;
      break;
    }
  }

  if (!cols || headerIdx < 0) {
    throw new FinanceImportError('NO_DATA', '날짜와 금액 컬럼을 찾지 못했습니다. CSV 형식을 확인해 주세요.');
  }

  const dataRows = rawLines.slice(headerIdx + 1).map(splitCsvLine);
  const { rows, skippedRows } = finalizeRows(dataRows, cols, 'csv');
  if (rows.length === 0) {
    throw new FinanceImportError('NO_DATA', '가져올 수 있는 유효한 거래 내역이 없습니다.');
  }

  return {
    format: 'csv',
    sheetName: null,
    rows,
    skippedRows,
  };
}

function extractSheetRows(sheet: ExcelJS.Worksheet): unknown[][] {
  const matrix: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    const vals = row.values;
    if (!Array.isArray(vals)) return;
    // ExcelJS row.values is 1-indexed ([empty, col1, col2, ...])
    const line = vals.slice(1).map(v => unwrapCellValue(v as ExcelJS.CellValue));
    matrix.push(line);
  });
  return matrix;
}

async function parseXlsxBuffer(buffer: Buffer, password?: string): Promise<ParsedFinanceFile> {
  let workingBuffer = buffer;
  const isOleEncrypted =
    (buffer.length >= OLE_CFB_MAGIC.length && buffer.subarray(0, OLE_CFB_MAGIC.length).equals(OLE_CFB_MAGIC)) ||
    officeCrypto.isEncrypted(buffer);

  if (isOleEncrypted) {
    if (!password || !password.trim()) {
      throw new FinanceImportError(
        'PASSWORD_REQUIRED',
        '비밀번호로 보호된 뱅크샐러드 엑셀 파일입니다. 비밀번호를 입력해 주세요.',
      );
    }
    try {
      workingBuffer = await officeCrypto.decrypt(buffer, { password });
    } catch {
      throw new FinanceImportError(
        'INVALID_PASSWORD',
        '엑셀 비밀번호가 올바르지 않거나 복호화할 수 없는 파일입니다.',
      );
    }
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(workingBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypt') || msg.includes('password') || msg.includes('corrupt')) {
      throw new FinanceImportError(
        'PARSE_ERROR',
        '엑셀 파일을 읽을 수 없습니다. .xlsx 형식 또는 비밀번호를 확인해 주세요.',
      );
    }
    throw new FinanceImportError('PARSE_ERROR', '엑셀 파일을 파싱하는 중 오류가 발생했습니다.');
  }

  // Prefer BankSalad's primary ledger sheet ('가계부 내역'), fallback to any sheet with date+amount headers.
  const orderedSheets = [...workbook.worksheets].sort((a, b) => {
    const aPreferred = a.name.replace(/\s+/g, '') === '가계부내역' ? 0 : 1;
    const bPreferred = b.name.replace(/\s+/g, '') === '가계부내역' ? 0 : 1;
    return aPreferred - bPreferred;
  });

  for (const sheet of orderedSheets) {
    const matrix = extractSheetRows(sheet);
    for (let i = 0; i < Math.min(10, matrix.length); i++) {
      const headers = matrix[i].map(v => String(v ?? ''));
      const cols = detectColumns(headers);
      if (!cols) continue;
      const { rows, skippedRows } = finalizeRows(matrix.slice(i + 1), cols, 'banksalad');
      if (rows.length > 0) {
        return {
          format: 'banksalad_xlsx',
          sheetName: sheet.name,
          rows,
          skippedRows,
        };
      }
    }
  }

  throw new FinanceImportError(
    'NO_DATA',
    '엑셀 시트에서 가계부 거래 내역(날짜·금액 컬럼)을 찾지 못했습니다.',
  );
}

export async function parseFinanceUploadFile(input: {
  fileName: string;
  buffer: Buffer;
  password?: string;
}): Promise<ParsedFinanceFile> {
  if (input.buffer.byteLength === 0) {
    throw new FinanceImportError('NO_DATA', '비어 있는 파일입니다.');
  }
  if (input.buffer.byteLength > MAX_FINANCE_UPLOAD_BYTES) {
    throw new FinanceImportError('FILE_TOO_LARGE', '파일 크기는 최대 10MB까지 지원합니다.');
  }

  const lower = input.fileName.trim().toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    return parseCsvBuffer(input.buffer);
  }
  if (lower.endsWith('.xlsx')) {
    return parseXlsxBuffer(input.buffer, input.password);
  }
  if (lower.endsWith('.xls')) {
    throw new FinanceImportError(
      'UNSUPPORTED_FORMAT',
      '.xls 구형 형식 대신 뱅크샐러드 통합 .xlsx 또는 .csv 파일을 업로드해 주세요.',
    );
  }

  throw new FinanceImportError(
    'UNSUPPORTED_FORMAT',
    '지원하지 않는 파일 형식입니다. .xlsx 또는 .csv 파일을 업로드해 주세요.',
  );
}

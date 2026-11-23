import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_IMPORT_URL = 'http://127.0.0.1:3000/api/finance/import/automation';

function loadEnvFallback() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(scriptDir, '..', '.env.finance-automation');
  if (!fs.existsSync(envPath)) return {};

  const parsed = {};
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eqIdx = normalized.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = normalized.slice(0, eqIdx).trim();
    let val = normalized.slice(eqIdx + 1).trim();
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    parsed[key] = val;
  }
  return parsed;
}

function parseArgs(argv) {
  let filePath = '';
  let overrideName = '';
  let mode = 'commit';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--preview') {
      mode = 'preview';
      continue;
    }
    if (arg === '--name') {
      overrideName = argv[i + 1] ?? '';
      i++;
      continue;
    }
    if (arg.startsWith('--name=')) {
      overrideName = arg.slice(7);
      continue;
    }
    if (!filePath && !arg.startsWith('--')) {
      filePath = arg;
    }
  }

  return { filePath, overrideName, mode };
}

async function main() {
  const { filePath, overrideName, mode } = parseArgs(process.argv.slice(2));
  if (!filePath) {
    console.error(
      '사용법: node upload-finance-automation.mjs <filePath> [--name <originalFileName>] [--preview]',
    );
    process.exit(1);
  }

  const fileEnv = loadEnvFallback();
  const token = (process.env.BINDER_IMPORT_TOKEN || fileEnv.BINDER_IMPORT_TOKEN || '').trim();
  const importUrl = (
    process.env.BINDER_IMPORT_URL ||
    fileEnv.BINDER_IMPORT_URL ||
    DEFAULT_IMPORT_URL
  ).trim();

  if (!token) {
    console.error(
      '오류: BINDER_IMPORT_TOKEN이 설정되지 않았습니다. 환경변수 또는 0. Source/.env.finance-automation 파일에 토큰을 넣어 주세요.',
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`오류: 파일을 찾을 수 없습니다: ${resolvedPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    console.error(`오류: 일반 파일이 아닙니다: ${resolvedPath}`);
    process.exit(1);
  }
  if (stat.size === 0) {
    console.error('오류: 비어 있는 파일입니다.');
    process.exit(1);
  }
  if (stat.size > MAX_FILE_BYTES) {
    console.error('오류: 파일 크기가 최대 허용치(10MB)를 초과했습니다.');
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const fileName = (overrideName || path.basename(resolvedPath)).trim() || 'banksalad.xlsx';

  const res = await fetch(importUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName,
      fileBase64: buffer.toString('base64'),
      mode,
    }),
  });

  const text = await res.text();
  let parsedBody = null;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    parsedBody = null;
  }

  if (parsedBody !== null) {
    console.log(JSON.stringify(parsedBody));
  } else if (text.trim()) {
    console.log(text.trim());
  }

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('업로드 요청 실패:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

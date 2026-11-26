import 'server-only';
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FinanceAutomationStatus } from '@/lib/financeAutomation';
import type { BinderDatabase } from '../db/connection';
import { financeAutomationConfigs, users } from '../db/schema';
import { encryptSecret } from '../googleCalendar/crypto';

export interface FinanceAutomationConfigRow {
  userId: string;
  enabled: boolean;
  tokenHash: string | null;
  tokenPrefix: string | null;
  excelPasswordEnc: string | null;
  lastImportAt: string | null;
  lastImportFileName: string | null;
  lastImportStatus: string | null;
  lastImportSummary: string | null;
  lastImportError: string | null;
  createdAt: string;
  updatedAt: string;
}

const TOKEN_PREFIX_STRING = 'bfi_';

export function hashAutomationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function generateAutomationToken(): {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const token = `${TOKEN_PREFIX_STRING}${crypto.randomBytes(24).toString('hex')}`;
  return {
    token,
    tokenHash: hashAutomationToken(token),
    tokenPrefix: token.slice(0, 12),
  };
}

/** Resolve an active Bearer token to its owning user and optional encrypted Excel password. */
export function resolveFinanceAutomationToken(
  database: BinderDatabase,
  rawToken: string,
): { userId: string; excelPasswordEnc: string | null } | null {
  if (
    typeof rawToken !== 'string' ||
    !rawToken.startsWith(TOKEN_PREFIX_STRING) ||
    rawToken.length < 20 ||
    rawToken.length > 128
  ) {
    return null;
  }

  const digest = hashAutomationToken(rawToken);
  const row = database
    .select({
      userId: financeAutomationConfigs.userId,
      tokenHash: financeAutomationConfigs.tokenHash,
      excelPasswordEnc: financeAutomationConfigs.excelPasswordEnc,
    })
    .from(financeAutomationConfigs)
    .innerJoin(users, eq(financeAutomationConfigs.userId, users.id))
    .where(
      and(
        eq(financeAutomationConfigs.tokenHash, digest),
        eq(financeAutomationConfigs.enabled, true),
      ),
    )
    .get();

  if (!row?.tokenHash) return null;

  const expectedBuf = Buffer.from(row.tokenHash, 'hex');
  const providedBuf = Buffer.from(digest, 'hex');
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return null;
  }

  return {
    userId: row.userId,
    excelPasswordEnc: row.excelPasswordEnc ?? null,
  };
}

function toStatus(
  row: FinanceAutomationConfigRow | null,
  endpointUrl: string,
): FinanceAutomationStatus {
  if (!row) {
    return {
      configured: false,
      enabled: false,
      tokenPrefix: null,
      hasExcelPassword: false,
      endpointUrl,
      lastImportAt: null,
      lastImportFileName: null,
      lastImportStatus: null,
      lastImportSummary: null,
      lastImportError: null,
      updatedAt: null,
    };
  }

  const lastImportStatus =
    row.lastImportStatus === 'success' || row.lastImportStatus === 'error'
      ? row.lastImportStatus
      : null;

  return {
    configured: Boolean(row.tokenHash),
    enabled: Boolean(row.enabled),
    tokenPrefix: row.tokenPrefix ?? null,
    hasExcelPassword: Boolean(row.excelPasswordEnc),
    endpointUrl,
    lastImportAt: row.lastImportAt ?? null,
    lastImportFileName: row.lastImportFileName ?? null,
    lastImportStatus,
    lastImportSummary: row.lastImportSummary ?? null,
    lastImportError: row.lastImportError ?? null,
    updatedAt: row.updatedAt,
  };
}

/** User-scoped storage for external Gmail agent import tokens, Excel password & telemetry. */
export class FinanceAutomationRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getRow(): FinanceAutomationConfigRow | null {
    const row = this.database
      .select()
      .from(financeAutomationConfigs)
      .where(eq(financeAutomationConfigs.userId, this.userId))
      .get();
    return (row as FinanceAutomationConfigRow | undefined) ?? null;
  }

  getStatus(endpointUrl: string): FinanceAutomationStatus {
    return toStatus(this.getRow(), endpointUrl);
  }

  issueToken(endpointUrl: string): { token: string; status: FinanceAutomationStatus } {
    const timestamp = this.now().toISOString();
    const generated = generateAutomationToken();

    const row = this.database.transaction(tx => {
      const existing = tx
        .select()
        .from(financeAutomationConfigs)
        .where(eq(financeAutomationConfigs.userId, this.userId))
        .get();

      if (existing) {
        return tx
          .update(financeAutomationConfigs)
          .set({
            enabled: true,
            tokenHash: generated.tokenHash,
            tokenPrefix: generated.tokenPrefix,
            updatedAt: timestamp,
          })
          .where(eq(financeAutomationConfigs.userId, this.userId))
          .returning()
          .get() as FinanceAutomationConfigRow;
      }

      const created: FinanceAutomationConfigRow = {
        userId: this.userId,
        enabled: true,
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
        excelPasswordEnc: null,
        lastImportAt: null,
        lastImportFileName: null,
        lastImportStatus: null,
        lastImportSummary: null,
        lastImportError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tx.insert(financeAutomationConfigs).values(created).run();
      return created;
    }, { behavior: 'immediate' });

    return {
      token: generated.token,
      status: toStatus(row, endpointUrl),
    };
  }

  revokeToken(endpointUrl: string): FinanceAutomationStatus {
    const timestamp = this.now().toISOString();
    const updated = this.database
      .update(financeAutomationConfigs)
      .set({
        enabled: false,
        tokenHash: null,
        tokenPrefix: null,
        updatedAt: timestamp,
      })
      .where(eq(financeAutomationConfigs.userId, this.userId))
      .returning()
      .get() as FinanceAutomationConfigRow | undefined;

    return toStatus(updated ?? null, endpointUrl);
  }

  updateSettings(
    patch: { enabled?: boolean; excelPassword?: string | null },
    endpointUrl: string,
  ): FinanceAutomationStatus {
    const timestamp = this.now().toISOString();
    const nextPasswordEnc =
      patch.excelPassword === undefined
        ? undefined
        : patch.excelPassword === null || patch.excelPassword === ''
          ? null
          : encryptSecret(patch.excelPassword);

    const row = this.database.transaction(tx => {
      const existing = tx
        .select()
        .from(financeAutomationConfigs)
        .where(eq(financeAutomationConfigs.userId, this.userId))
        .get() as FinanceAutomationConfigRow | undefined;

      if (!existing) {
        if (patch.enabled === undefined && (nextPasswordEnc === undefined || nextPasswordEnc === null)) {
          return null;
        }
        const created: FinanceAutomationConfigRow = {
          userId: this.userId,
          enabled: patch.enabled ?? false,
          tokenHash: null,
          tokenPrefix: null,
          excelPasswordEnc: nextPasswordEnc ?? null,
          lastImportAt: null,
          lastImportFileName: null,
          lastImportStatus: null,
          lastImportSummary: null,
          lastImportError: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        tx.insert(financeAutomationConfigs).values(created).run();
        return created;
      }

      return tx
        .update(financeAutomationConfigs)
        .set({
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(nextPasswordEnc !== undefined ? { excelPasswordEnc: nextPasswordEnc } : {}),
          updatedAt: timestamp,
        })
        .where(eq(financeAutomationConfigs.userId, this.userId))
        .returning()
        .get() as FinanceAutomationConfigRow;
    }, { behavior: 'immediate' });

    return toStatus(row, endpointUrl);
  }

  recordImportSuccess(input: {
    fileName: string;
    inserted: number;
    duplicates: number;
    skipped: number;
  }): void {
    const timestamp = this.now().toISOString();
    const parts = [`신규 ${input.inserted}건 반영`, `중복 ${input.duplicates}건 건너뜀`];
    if (input.skipped > 0) {
      parts.push(`비거래 ${input.skipped}건 스킵`);
    }
    const summary = parts.join(' · ');

    this.database
      .update(financeAutomationConfigs)
      .set({
        lastImportAt: timestamp,
        lastImportFileName: input.fileName.slice(0, 255),
        lastImportStatus: 'success',
        lastImportSummary: summary,
        lastImportError: null,
        updatedAt: timestamp,
      })
      .where(eq(financeAutomationConfigs.userId, this.userId))
      .run();
  }

  recordImportError(input: { fileName: string; error: string }): void {
    const timestamp = this.now().toISOString();
    this.database
      .update(financeAutomationConfigs)
      .set({
        lastImportAt: timestamp,
        lastImportFileName: input.fileName.slice(0, 255),
        lastImportStatus: 'error',
        lastImportSummary: null,
        lastImportError: input.error.slice(0, 500),
        updatedAt: timestamp,
      })
      .where(eq(financeAutomationConfigs.userId, this.userId))
      .run();
  }
}

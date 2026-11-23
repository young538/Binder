import type {
  FinanceImportCommitResult,
  FinanceImportPreview,
} from '../finance';
import type {
  FinanceBudget,
  FinanceTransaction,
  FinanceTransactionKind,
} from '../types';
import { notifyMutation } from './events';
import { http } from './http';

export class FinanceImportApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'FinanceImportApiError';
  }
}

export const listFinanceTransactions = (params?: {
  month?: string;
  startDate?: string;
  endDate?: string;
  kind?: FinanceTransactionKind;
}): Promise<FinanceTransaction[]> => {
  const qs = new URLSearchParams();
  if (params?.month) qs.set('month', params.month);
  if (params?.startDate) qs.set('startDate', params.startDate);
  if (params?.endDate) qs.set('endDate', params.endDate);
  if (params?.kind) qs.set('kind', params.kind);
  const query = qs.toString();
  return http.get<FinanceTransaction[]>(`/api/finance/transactions${query ? `?${query}` : ''}`);
};

export const createFinanceTransaction = async (
  data: Omit<FinanceTransaction, 'id' | 'userId' | 'externalHash' | 'createdAt' | 'updatedAt'>,
): Promise<FinanceTransaction> => {
  const row = await http.post<FinanceTransaction>('/api/finance/transactions', data);
  notifyMutation('financeTransactions');
  return row;
};

export const updateFinanceTransaction = async (
  id: string,
  patch: Partial<Omit<FinanceTransaction, 'id' | 'userId' | 'externalHash' | 'createdAt'>>,
): Promise<FinanceTransaction> => {
  const row = await http.patch<FinanceTransaction>(`/api/finance/transactions/${id}`, patch);
  notifyMutation('financeTransactions');
  return row;
};

export const deleteFinanceTransaction = async (id: string): Promise<void> => {
  await http.del(`/api/finance/transactions/${id}`);
  notifyMutation('financeTransactions');
};

export const listFinanceBudgets = (yyyymm?: string): Promise<FinanceBudget[]> => {
  const query = yyyymm ? `?yyyymm=${encodeURIComponent(yyyymm)}` : '';
  return http.get<FinanceBudget[]>(`/api/finance/budgets${query}`);
};

export const upsertFinanceBudget = async (input: {
  yyyymm: string;
  category: string;
  amount: number;
}): Promise<FinanceBudget> => {
  const row = await http.put<FinanceBudget>('/api/finance/budgets', input);
  notifyMutation('financeBudgets');
  return row;
};

export const deleteFinanceBudget = async (id: string): Promise<void> => {
  await http.del(`/api/finance/budgets?id=${encodeURIComponent(id)}`);
  notifyMutation('financeBudgets');
};

export const syncSubscriptionsToFinance = async (
  yyyymm: string,
): Promise<{ yyyymm: string; created: number; skipped: number }> => {
  const res = await http.post<{ yyyymm: string; created: number; skipped: number }>(
    '/api/finance/sync-subscriptions',
    { yyyymm },
  );
  notifyMutation('financeTransactions');
  return res;
};

async function sendFinanceImport<T>(
  mode: 'preview' | 'commit',
  file: File,
  password?: string,
): Promise<T> {
  const form = new FormData();
  form.set('mode', mode);
  form.set('file', file);
  if (password && password.length > 0) {
    form.set('password', password);
  }

  const res = await fetch('/api/finance/import', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${next}`;
    }
    throw new FinanceImportApiError('로그인이 필요합니다.');
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    throw new FinanceImportApiError(
      data.error ?? `가져오기에 실패했습니다 (${res.status}).`,
      data.code,
    );
  }

  if (mode === 'commit') {
    notifyMutation('financeTransactions');
  }
  return data as T;
}

export const previewFinanceImport = (
  file: File,
  password?: string,
): Promise<FinanceImportPreview> => sendFinanceImport<FinanceImportPreview>('preview', file, password);

export const commitFinanceImport = (
  file: File,
  password?: string,
): Promise<FinanceImportCommitResult> =>
  sendFinanceImport<FinanceImportCommitResult>('commit', file, password);

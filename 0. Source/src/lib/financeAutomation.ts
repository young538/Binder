export interface FinanceAutomationStatus {
  configured: boolean;
  enabled: boolean;
  tokenPrefix: string | null;
  hasExcelPassword: boolean;
  endpointUrl: string;
  lastImportAt: string | null;
  lastImportFileName: string | null;
  lastImportStatus: 'success' | 'error' | null;
  lastImportSummary: string | null;
  lastImportError: string | null;
  updatedAt: string | null;
}

export const DEFAULT_GMAIL_DONE_LABEL = 'Binder-Finance-Imported';

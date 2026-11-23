import { handleFinanceAutomationImport } from '@/lib/server/finance/automationImport';

export async function POST(req: Request): Promise<Response> {
  return handleFinanceAutomationImport(req);
}

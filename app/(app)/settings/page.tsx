import { CategoryEditor } from '@/components/settings/CategoryEditor';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { DataImportPanel } from '@/components/settings/DataImportPanel';

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">설정</h1>
      <CategoryEditor />
      <SettingsForm />
      <DataImportPanel />
    </div>
  );
}

import { CategoryEditor } from '@/components/settings/CategoryEditor';
import { HabitEditor } from '@/components/settings/HabitEditor';
import { RoutineEditor } from '@/components/settings/RoutineEditor';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { DataImportPanel } from '@/components/settings/DataImportPanel';
import { DataExportPanel } from '@/components/settings/DataExportPanel';
import { SnapshotPanel } from '@/components/settings/SnapshotPanel';

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">설정</h1>
      <CategoryEditor />
      <HabitEditor />
      <RoutineEditor />
      <SettingsForm />
      <DataImportPanel />
      <DataExportPanel />
      <SnapshotPanel />
    </div>
  );
}

import { CategoryEditor } from '@/components/settings/CategoryEditor';
import { SettingsForm } from '@/components/settings/SettingsForm';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">설정</h1>
      <CategoryEditor />
      <SettingsForm />
    </div>
  );
}

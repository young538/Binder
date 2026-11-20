import { LifePage } from '@/components/life/LifePage';

export default async function LifeRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; person?: string }>;
}) {
  const { tab, person } = await searchParams;
  const initialTab = tab === 'people' ? 'people' : 'events';
  return <LifePage initialTab={initialTab} initialPersonId={person} />;
}

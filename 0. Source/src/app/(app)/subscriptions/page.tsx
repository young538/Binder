import { SubscriptionsPage } from '@/components/subscriptions/SubscriptionsPage';

export default async function SubscriptionsRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string }>;
}) {
  const { subscription } = await searchParams;
  return <SubscriptionsPage initialSubscriptionId={subscription} />;
}

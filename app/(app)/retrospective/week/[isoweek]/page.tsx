export default async function WeeklyRetroPage({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return <div className="p-4">주간 회고 {isoweek}</div>;
}

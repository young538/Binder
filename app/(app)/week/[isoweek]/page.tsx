export default async function WeekPage({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return <div className="p-4">주간 뷰 {isoweek}</div>;
}

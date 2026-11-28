interface Props {
  label: string;
  query: { loading: boolean; error: unknown; refresh: (showLoading?: boolean) => Promise<void> };
}

export function FinanceReadStatus({ label, query }: Props) {
  if (query.loading) {
    return <p role="status" className="text-sm text-zinc-500">{label} 불러오는 중…</p>;
  }
  if (!query.error) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 p-3 text-sm">
      <span>{label} 조회에 실패했습니다.</span>
      <button type="button" onClick={() => void query.refresh(true)}
        aria-label={`${label} 다시 불러오기`} className="font-semibold underline">
        다시 불러오기
      </button>
    </div>
  );
}

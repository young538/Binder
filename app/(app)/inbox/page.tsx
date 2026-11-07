import { TodoListSection } from '@/components/common/TodoListSection';

export default function InboxPage() {
  return <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24 md:p-6">
    <header><h1 className="text-2xl font-bold">수집함</h1><p className="mt-2 text-sm leading-6 text-zinc-500">날짜를 정하기 전의 생각과 할 일입니다. 항목의 상세 설정에서 날짜·목표·메모를 정리하세요.</p></header>
    <TodoListSection scope="inbox" scopeKey="inbox" title="모아 둔 할 일" />
  </div>;
}

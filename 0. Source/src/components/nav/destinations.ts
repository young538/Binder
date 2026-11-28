import { format } from 'date-fns';
import {
  Activity, BookMarked, BookOpen, Calendar, CalendarDays, CalendarHeart, CalendarRange, CreditCard,
  FolderKanban, Inbox, LayoutDashboard, Library, NotebookPen, Search, Settings, Sun, Syringe, Target, Wallet,
  type LucideIcon,
} from 'lucide-react';
import { toIsoDate, toIsoWeek } from '@/lib/utils/date';

const month = (date: Date) => format(date, 'yyyy-MM');
const year = (date: Date) => format(date, 'yyyy');

function destination(label: string, basePath: string, Icon: LucideIcon, searchLabel = label, period?: (date: Date) => string) {
  return {
    label, basePath, Icon, searchLabel,
    href: (date = new Date()) => period ? `${basePath}/${period(date)}` : basePath,
    subtitle: (date: Date) => period ? period(date) : basePath,
  };
}

export const destinations = {
  dashboard: destination('홈', '/dashboard', LayoutDashboard, '인생 OS 대시보드'),
  daily: destination('일일', '/daily', Sun, '오늘 일일 트래커', toIsoDate),
  projects: destination('프로젝트', '/projects', FolderKanban, '프로젝트 실행 보드'),
  notes: destination('원칙 · 노트', '/notes', BookMarked, '원칙 · 의사결정 · 노트'),
  wiki: destination('지식 위키', '/wiki', Library, 'LLM 지식 위키'),
  injections: destination('주사 기록', '/injections', Syringe),
  metrics: destination('상태 지표', '/metrics', Activity, '상태 지표 트래커'),
  finance: destination('가계부', '/finance', Wallet, '가계부 · 예산'),
  subscriptions: destination('구독 · 월정액', '/subscriptions', CreditCard, '구독 · 월정액 관리'),
  life: destination('일정 · 사람', '/life', CalendarHeart, '일정 · 기념일 · 인간관계'),
  week: destination('주간', '/week', Calendar, '이번 주 시간표', toIsoWeek),
  monthly: destination('월간', '/monthly', CalendarDays, '이번 달 달력', month),
  annual: destination('연간', '/annual', CalendarRange, '올해 연간 목표', year),
  mandalart: destination('One-Thing', '/mandalart', Target, 'One-Thing 보드'),
  retroWeek: destination('회고', '/retrospective/week', NotebookPen, '주간 회고', toIsoWeek),
  retroMonth: destination('월간 회고', '/retrospective/month', NotebookPen, '월간 회고', month),
  retroYear: destination('연간 회고', '/retrospective/year', NotebookPen, '연간 회고', year),
  reading: destination('독서', '/reading', BookOpen, '독서 리스트'),
  inbox: destination('할 일', '/inbox', Inbox, '수집함'),
  goalReview: destination('목표 실행 점검', '/goal-review', Target),
  search: destination('전체 검색', '/search', Search, '전체 검색 페이지'),
  settings: destination('설정', '/settings', Settings, '설정 · 백업'),
};

// The menu opens the weekly retrospective and stays highlighted on all retrospective pages.
export const retrospectiveMenu = { ...destinations.retroWeek, basePath: '/retrospective' };

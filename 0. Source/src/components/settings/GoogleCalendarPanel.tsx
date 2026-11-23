'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarSync,
  Check,
  Copy,
  ExternalLink,
  ListChecks,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { useBinder } from '@/store';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  syncGoogleCalendar,
  updateGoogleCalendarSettings,
} from '@/lib/repo/googleCalendar';

const REASON_MESSAGE: Record<string, string> = {
  invalid_state: 'OAuth 보안 상태(state) 검증에 실패했습니다. 다시 연결을 시도해 주세요.',
  access_denied: 'Google 계정 권한 승인이 취소되었습니다.',
  missing_code: 'Google 인증 코드가 전달되지 않았습니다.',
  not_configured: '서버에 Google OAuth 환경변수가 설정되지 않았습니다.',
  missing_refresh_token: 'Refresh Token을 받지 못했습니다. Google 계정 앱 권한에서 기존 승인을 해제한 뒤 다시 연결해 주세요.',
  exchange_failed: 'Google 인증 토큰 교환에 실패했습니다. 리디렉션 URI와 Client ID/Secret을 확인해 주세요.',
};

function GoogleOAuthQueryBanner() {
  const sp = useSearchParams();
  const google = sp.get('google');
  const reason = sp.get('reason') ?? '';
  if (google !== 'connected' && google !== 'error') return null;
  const isError = google === 'error';
  const text = isError
    ? REASON_MESSAGE[reason] ?? 'Google 캘린더 연결 중 오류가 발생했습니다.'
    : 'Google 캘린더 계정을 연결하고 초기 일정을 동기화했어요.';
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
        isError
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
      }`}
    >
      {text}
    </p>
  );
}

export function GoogleCalendarPanel() {
  const { projects = [] } = useBinder();
  const { value: status, loading, error, refresh } = useAsyncResource(
    'google-calendar:status',
    getGoogleCalendarStatus,
    null,
    ['googleCalendar'],
  );

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [purgeOnDisconnect, setPurgeOnDisconnect] = useState(false);

  const copyRedirectUri = async () => {
    if (!status?.redirectUri || !navigator.clipboard) return;
    await navigator.clipboard.writeText(status.redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSync = async () => {
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await syncGoogleCalendar();
      const tasksInfo = res.tasks
        ? res.tasks.error
          ? ` · Tasks 오류: ${res.tasks.error}`
          : ` · Tasks(${res.tasks.listsSynced}개 목록): 가져옴 ${res.tasks.pulledCreated} · 갱신 ${res.tasks.pulledUpdated} · 삭제 ${res.tasks.pulledDeleted} · 보냄 ${res.tasks.pushedCreated + res.tasks.pushedUpdated}`
        : '';
      setBanner({
        kind: res.tasks?.error ? 'error' : 'success',
        text: `동기화 완료 (${res.calendarsSynced}개 캘린더): 새로 가져옴 ${res.pulledCreated} · 갱신 ${res.pulledUpdated} · 구글 삭제 반영 ${res.pulledDeleted} · 구글로 보냄 ${res.pushedCreated}${tasksInfo}`,
      });
      await refresh(true);
    } catch (err) {
      setBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Google 캘린더 동기화에 실패했습니다.',
      });
    } finally {
      setBusy(false);
    }
  };

  const patchSettings = async (patch: Parameters<typeof updateGoogleCalendarSettings>[0]) => {
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      await updateGoogleCalendarSettings(patch);
      await refresh(true);
      setBanner({ kind: 'success', text: 'Google 캘린더 동기화 설정을 저장했어요.' });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : '설정을 저장하지 못했습니다.',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleCalendar = (calId: string) => {
    if (!status?.connection) return;
    const current = new Set(status.connection.selectedCalendarIds);
    if (current.has(calId)) current.delete(calId);
    else current.add(calId);
    void patchSettings({ selectedCalendarIds: [...current] });
  };

  const toggleTaskList = (listId: string) => {
    if (!status?.connection) return;
    const current = new Set(status.connection.tasksSelectedListIds);
    if (current.has(listId)) current.delete(listId);
    else current.add(listId);
    void patchSettings({ tasksSelectedListIds: [...current] });
  };

  const setTaskListProjectMapping = (listId: string, projectId: string) => {
    if (!status?.connection) return;
    const nextMap: Record<string, string | null> = { ...status.connection.tasksProjectMap };
    if (projectId) nextMap[listId] = projectId;
    else nextMap[listId] = null;
    void patchSettings({ tasksProjectMap: nextMap });
  };

  const handleDisconnect = async () => {
    if (busy) return;
    const message = purgeOnDisconnect
      ? 'Google 캘린더 연결을 해제하고 동기화된 Google 일정도 바인더에서 삭제할까요?'
      : 'Google 캘린더 연결을 해제할까요? 이미 가져온 일정은 바인더에 유지됩니다.';
    if (!confirm(message)) return;

    setBusy(true);
    setBanner(null);
    try {
      const res = await disconnectGoogleCalendar(purgeOnDisconnect);
      setBanner({
        kind: 'success',
        text: purgeOnDisconnect
          ? `연결을 해제하고 Google 동기화 일정 ${res.deletedEvents}개를 삭제했어요.`
          : 'Google 캘린더 연결을 해제했어요.',
      });
      await refresh(true);
    } catch (err) {
      setBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : '연결 해제에 실패했습니다.',
      });
    } finally {
      setBusy(false);
    }
  };

  const conn = status?.connection ?? null;
  const writableCalendars = (conn?.calendarMeta ?? []).filter(
    c => c.accessRole === 'owner' || c.accessRole === 'writer',
  );
  const mappableProjects = projects.filter(p => p.status !== 'done');

  return (
    <section
      id="google-calendar"
      aria-label="Google 캘린더 양방향 연동"
      className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-800 dark:text-zinc-100">
            <CalendarSync size={17} className="text-blue-600 dark:text-blue-400" />
            Google 캘린더 양방향 연동
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Google OAuth 2.0으로 내 캘린더 일정을 가져오고, 바인더의 일반 일정 변경 사항을 Google 캘린더에도 자동으로 반영합니다.
          </p>
        </div>
        {conn && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Check size={12} /> 연결됨
          </span>
        )}
      </div>

      {!banner ? (
        <Suspense fallback={null}>
          <GoogleOAuthQueryBanner />
        </Suspense>
      ) : (
        <p
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            banner.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {banner.text}
        </p>
      )}

      {loading && !status && <p className="text-xs text-zinc-500">Google 연동 상태를 확인하는 중…</p>}
      {!!error && (
        <button type="button" onClick={() => void refresh()} className="text-xs text-red-600 hover:underline">
          연동 상태를 불러오지 못했어요. 다시 시도
        </button>
      )}

      {status && (
        <>
          <div className="rounded-xl bg-zinc-50 p-3 text-xs space-y-1.5 dark:bg-zinc-900">
            <div className="font-medium text-zinc-700 dark:text-zinc-300">승인된 리디렉션 URI (Google Cloud 등록용)</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800">
                {status.redirectUri}
              </code>
              <button
                type="button"
                onClick={() => void copyRedirectUri()}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
          </div>

          {!status.configured ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="font-semibold">서버에 OAuth 클라이언트 설정이 필요합니다</div>
              <p className="leading-5">
                운영 <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">0. Source/app.env</code> (또는 로컬 <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">.env.local</code>)에{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">GOOGLE_CLIENT_ID</code>와{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">GOOGLE_CLIENT_SECRET</code>을 추가하고 앱을 재시작하면 연결 버튼이 활성화됩니다.
              </p>
              <details className="rounded-lg bg-white/80 p-2.5 text-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-200">
                <summary className="cursor-pointer font-semibold text-zinc-800 dark:text-zinc-100">
                  Google Cloud Console OAuth 발급 4단계 가이드
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4 leading-5">
                  <li>Google Cloud Console에서 프로젝트 생성 후 <strong>Google Calendar API</strong>를 사용 설정합니다.</li>
                  <li><strong>OAuth 동의 화면</strong>에서 External 선택 → 본인 Google 이메일을 테스트 사용자로 추가합니다.</li>
                  <li><strong>사용자 인증 정보 → OAuth 클라이언트 ID (웹 애플리케이션)</strong> 생성 시 위 리디렉션 URI를 정확히 입력합니다.</li>
                  <li>발급된 Client ID / Secret을 환경변수 파일에 저장한 뒤 컨테이너를 다시 시작합니다.</li>
                </ol>
              </details>
            </div>
          ) : !conn ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800">
              <div className="text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                연결할 Google 계정을 선택하고 캘린더 읽기·쓰기 권한을 허용해 주세요.
              </div>
              <a
                href="/api/integrations/google/connect?returnTo=/settings"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <ExternalLink size={13} /> Google 캘린더 연결하기
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800">
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">연결 계정: </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{conn.googleEmail}</span>
                  </div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    마지막 동기화:{' '}
                    {conn.lastSyncedAt
                      ? new Date(conn.lastSyncedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                      : '아직 동기화 기록 없음'}
                  </div>
                  {conn.syncEnabled && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      자동 동기화 켜짐 · 앱 열기(10분 쿨다운)와 서버 백그라운드(15분 주기)로 Google 일정을 자동 반영합니다.
                    </div>
                  )}
                  {conn.lastSyncError && (
                    <div className="text-red-600 dark:text-red-400">최근 오류: {conn.lastSyncError}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSync()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> 지금 동기화
                  </button>
                  <a
                    href="/api/integrations/google/connect?returnTo=/settings"
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    계정 다시 연결
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">가져올 Google 캘린더</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {conn.calendarMeta.map(cal => {
                    const checked = conn.selectedCalendarIds.includes(cal.id);
                    return (
                      <label
                        key={cal.id}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                      >
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={checked}
                          onChange={() => toggleCalendar(cal.id)}
                          className="rounded border-zinc-300 text-blue-600"
                        />
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cal.backgroundColor ?? '#3b82f6' }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-zinc-800 dark:text-zinc-200">
                          {cal.summary}
                        </span>
                        {cal.primary && (
                          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            기본
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  바인더 새 일정을 보낼 Google 캘린더
                  <select
                    aria-label="내보낼 Google 캘린더"
                    disabled={busy || writableCalendars.length === 0}
                    value={conn.pushCalendarId}
                    onChange={e => void patchSettings({ pushCalendarId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {writableCalendars.map(cal => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary}{cal.primary ? ' (기본)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2 pt-1 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={conn.autoPushEvents}
                      onChange={e => void patchSettings({ autoPushEvents: e.target.checked })}
                      className="rounded border-zinc-300 text-blue-600"
                    />
                    <span>바인더 일정 생성·수정·삭제 시 Google에 자동 반영</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={conn.syncEnabled}
                      onChange={e => void patchSettings({ syncEnabled: e.target.checked })}
                      className="rounded border-zinc-300 text-blue-600"
                    />
                    <span>자동 양방향 동기화 활성화 (앱 접속 10분 · 서버 15분 주기)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      <ListChecks size={15} className="text-emerald-600 dark:text-emerald-400" />
                      Google Tasks 할 일 양방향 연동
                    </h3>
                    <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      수집함과 오늘·일간 할 일(마감일 포함)을 Google Tasks와 양방향으로 동기화하고, 작업 목록별 바인더 프로젝트를 연결합니다.
                    </p>
                  </div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    최근 Tasks 동기화:{' '}
                    {conn.tasksLastSyncedAt
                      ? new Date(conn.tasksLastSyncedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                      : '아직 기록 없음'}
                  </span>
                </div>

                {conn.tasksLastSyncError && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    <span>{conn.tasksLastSyncError}</span>
                    <a
                      href="/api/integrations/google/connect?returnTo=/settings"
                      className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                    >
                      계정 다시 연결
                    </a>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 text-xs">
                    <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={conn.tasksSyncEnabled}
                        onChange={e => void patchSettings({ tasksSyncEnabled: e.target.checked })}
                        className="rounded border-zinc-300 text-emerald-600"
                      />
                      <span>Google Tasks 양방향 동기화 활성화</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={conn.tasksAutoPush}
                        onChange={e => void patchSettings({ tasksAutoPush: e.target.checked })}
                        className="rounded border-zinc-300 text-emerald-600"
                      />
                      <span>수집함·일간 할 일 생성/완료/수정 시 즉시 반영</span>
                    </label>
                  </div>

                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    기본 Google Tasks 목록 (프로젝트 미연결 할 일)
                    <select
                      aria-label="기본 Google Tasks 목록"
                      disabled={busy || conn.tasksListMeta.length === 0}
                      value={conn.tasksDefaultListId ?? ''}
                      onChange={e => void patchSettings({ tasksDefaultListId: e.target.value || null })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      {conn.tasksListMeta.length === 0 ? (
                        <option value="">목록 불러오는 중 (동기화 필요)</option>
                      ) : (
                        conn.tasksListMeta.map(list => (
                          <option key={list.id} value={list.id}>
                            {list.title}{list.isDefault ? ' (기본)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>

                {conn.tasksListMeta.length === 0 ? (
                  <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    Google Tasks 목록이 아직 없습니다. 새 Tasks 권한을 허용하려면 &lsquo;계정 다시 연결&rsquo; 후 지금 동기화를 눌러 주세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      동기화할 Google Tasks 목록 및 바인더 프로젝트 연결
                    </div>
                    <div className="space-y-1.5">
                      {conn.tasksListMeta.map(list => {
                        const checked = conn.tasksSelectedListIds.includes(list.id);
                        const mappedProjectId = conn.tasksProjectMap?.[list.id] ?? '';
                        return (
                          <div
                            key={list.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
                          >
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={busy}
                                checked={checked}
                                onChange={() => toggleTaskList(list.id)}
                                className="rounded border-zinc-300 text-emerald-600"
                              />
                              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                                {list.title}
                              </span>
                              {list.isDefault && (
                                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  기본
                                </span>
                              )}
                            </label>
                            <select
                              aria-label={`${list.title} 프로젝트 연결`}
                              disabled={busy}
                              value={mappedProjectId}
                              onChange={e => setTaskListProjectMapping(list.id, e.target.value)}
                              className="min-w-0 max-w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:w-52"
                            >
                              <option value="">프로젝트 미연결 (기본 수집함)</option>
                              {mappableProjects.map(project => (
                                <option key={project.id} value={project.id}>
                                  📁 {project.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
                <label className="flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={purgeOnDisconnect}
                    onChange={e => setPurgeOnDisconnect(e.target.checked)}
                    className="rounded border-zinc-300 text-red-600"
                  />
                  <span>연결 해제 시 동기화된 Google 일정도 함께 삭제</span>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDisconnect()}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Unlink size={13} /> 연결 해제
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

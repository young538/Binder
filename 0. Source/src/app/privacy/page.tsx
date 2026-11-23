import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보처리방침 · Super 플래너 (BinderOS)',
  description: 'Super 플래너 (BinderOS) 개인정보처리방침 및 Google 캘린더 API 데이터 처리 안내',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 md:py-12">
      <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
        <header className="space-y-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Super 플래너 · BinderOS
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">개인정보처리방침</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            시행일: 2026년 11월 · 자체 호스팅 개인 플래너(https://young538.synology.me)
          </p>
        </header>

        <section className="space-y-2 text-sm leading-6">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">1. 수집 및 처리하는 정보</h2>
          <p className="text-zinc-600 dark:text-zinc-300">
            Super 플래너(BinderOS)는 개인 및 허가된 계정을 위한 자체 호스팅 일정·목표·기록 관리 앱입니다.
            로그인을 위한 사용자 아이디와 Argon2id로 해시된 비밀번호, 그리고 사용자가 직접 입력한 일정,
            할 일, 프로젝트, 습관, 회고, 지표, 구독 내역만을 저장합니다.
          </p>
          <p className="text-zinc-600 dark:text-zinc-300">
            사용자가 설정 화면에서 Google 캘린더 연동을 직접 승인한 경우에 한해, 연결된 Google 계정의
            이메일 주소, 선택한 캘린더 메타데이터, 그리고 해당 캘린더의 일정 데이터를 동기화 목적으로 조회·저장합니다.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-6">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            2. Google 캘린더 API 데이터 이용 및 제한(Google API Services User Data Policy)
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
            <li>
              Google 캘린더에서 가져온 정보는 사용자의 BinderOS 일일/주간 시간표 및 라이프 허브에서 일정을
              표시하고 양방향으로 동기화하는 기능에만 사용됩니다.
            </li>
            <li>
              Google 사용자 데이터를 제3자에게 판매, 임대, 공유하거나 광고 타게팅 및 AI/ML 모델 학습에 사용하지
              않습니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm leading-6">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">3. 보관, 보안 및 연동 해제</h2>
          <p className="text-zinc-600 dark:text-zinc-300">
            모든 데이터는 운영자의 자체 서버(SQLite 데이터베이스)에 저장되며, Google OAuth Access Token 및
            Refresh Token은 AES-256-GCM으로 암호화해 보관합니다. 사용자는 언제든지 설정 화면의{' '}
            <strong>Google 캘린더 연동 해제</strong> 버튼 또는 Google 계정 보안 설정에서 권한을 철회해
            인증 토큰을 즉시 삭제할 수 있습니다.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-6 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Privacy Summary (English)
          </h2>
          <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-300">
            Super Planner (BinderOS) is a self-hosted personal productivity application running at{' '}
            <code>https://young538.synology.me</code>. Google Calendar OAuth tokens (encrypted with
            AES-256-GCM) and calendar event fields are accessed solely when explicitly connected by the
            authenticated owner to display and synchronize events inside BinderOS. Data is stored on the
            owner&apos;s private server, never shared with third parties, never used for advertising, and never used to
            train AI/ML models, in full compliance with the Google API Services User Data Policy (Limited Use).
          </p>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span>문의: young538@gmail.com</span>
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            로그인으로 돌아가기
          </Link>
        </footer>
      </article>
    </main>
  );
}

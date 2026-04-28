# 멀티 유저 지원 (Multi-User Support) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 인스턴스에서 두 명 이상의 사용자(`young538`, `leemia79`)가 각자 독립된 데이터를 가지고 로그인할 수 있게 한다. 기존 single-user 데이터는 모두 보존하여 기본 admin (`young538`)에게 매핑한다.

**Architecture:** `users` 테이블을 신설하고 모든 도메인 테이블에 `user_id` 외래키를 추가한다. 모든 server repo 메서드는 첫 인자로 `userId`를 받고, API route는 `requireSession()` 으로부터 `userId`를 꺼내 repo에 전달한다. 기존 데이터는 마이그레이션 단계에서 admin 사용자로 일괄 backfill 후 `NOT NULL` 제약을 건다. 사용자 관리는 별도 UI 없이 CLI 스크립트(`scripts/users.mjs`)로 처리한다 — 추가/삭제/비번 변경.

**Tech Stack:** Next.js 16 / Drizzle ORM 0.45 / better-sqlite3 / iron-session / argon2 / Vitest 4 / Playwright 1.59 / TypeScript 5.

---

## 사전 결정 사항 (변경 가능)

이 plan을 실행하기 전에 다음 결정이 합리적이라고 가정한다. 사용자가 다른 의견을 줄 경우 plan을 수정 후 진행한다.

| 결정 | 채택안 | 대안 |
|---|---|---|
| 사용자 추가 방법 | CLI 스크립트만 | 어드민 UI 추가 |
| 비밀번호 변경 | CLI 스크립트만 | settings 페이지에 본인 비번 변경 UI |
| 사용자 삭제 | CLI 스크립트로만 (CASCADE 삭제) | UI 추가 |
| 기존 데이터 매핑 | 모두 `young538` 으로 자동 매핑 | 일부를 `leemia79` 로 수동 분배 |
| `leemia79` 비번 | `young7983*` (사용자 지시) | 보안상 다른 비번 권장 — 사용자 결정 |
| 사용자 식별자 | `id` (ULID) + `username` (unique). `username` 변경 가능 | username 자체를 PK로 |
| categories seed | 사용자 추가 시 기본 8개 자동 생성 | 빈 상태로 두고 사용자가 직접 |
| `goals.parentId` 같은 self-ref | userId 검증 application-level (DB 외래키는 단순 id 참조) | DB 레벨 복합 외래키 |

## 파일 변경 맵

**Modify (영향 큰 순):**
- `lib/server/db/schema.ts` — `users` 추가, 도메인 10개 테이블에 `userId` 추가, `settings` PK 변경
- `lib/server/db/client.ts` — admin 시딩 로직, categories per-user 시딩 (현재 글로벌)
- `lib/server/auth.ts` — `verifyPassword(plain)` → `verifyCredentials(username, password) -> {userId}`; session payload 에 userId 포함; `requireSession() -> {userId, username}`
- `lib/server/repos/*.ts` × 10 — 모든 메서드 첫 인자 `userId: string` 추가, 모든 query 에 `eq(t.userId, userId)` 필터
- `app/api/**/route.ts` × 24 — session 으로부터 userId 꺼내 repo 호출, body 에 userId 강제
- `app/api/auth/login/route.ts` — DB 기반 인증, session 에 userId 저장
- `lib/types.ts` — 도메인 타입에 `userId` 추가
- `tests/unit/*.ts` — 각 테스트가 user 컨텍스트 안에서 동작하도록 수정
- `tests/e2e/_helpers.ts` — 헬퍼에 user 시딩 추가

**Create:**
- `drizzle/0002_multi_user_schema.sql` — users 테이블, 도메인 테이블 user_id (nullable) 추가
- `drizzle/0003_user_id_not_null.sql` — backfill 후 NOT NULL 변경 (코드에서 backfill 후 적용)
- `scripts/users.mjs` — CLI: `add | list | passwd | delete`
- `tests/unit/auth-multiuser.test.ts` — 인증 + 시딩
- `tests/unit/repo-isolation.test.ts` — repo 가 다른 user 데이터를 절대 반환하지 않음 검증
- `tests/e2e/multiuser.spec.ts` — 두 사용자가 서로의 데이터를 못 봄 (E2E)

**Delete:**
- `lib/repo/syncMeta.ts` (이미 stub이므로 정리)

---

## Task 1: `users` 테이블 + 첫 admin 시딩

**Goal:** 스키마에 `users` 테이블을 추가하고, 컨테이너 첫 시동 시 `.env` 의 `APP_USERNAME` / `APP_PASSWORD_HASH` 로 admin 사용자를 자동 생성한다.

**Files:**
- Modify: `lib/server/db/schema.ts` (테이블 추가)
- Modify: `lib/server/db/client.ts` (`ensureAdminUser` 함수 추가, `getDb` 안에서 호출)
- Create: `drizzle/0002_multi_user_schema.sql` — drizzle-kit generate 결과
- Test: `tests/unit/auth-multiuser.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/auth-multiuser.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';

const TMP_DB = path.join(process.cwd(), 'tmp-test', `auth-${Date.now()}.sqlite`);

beforeEach(() => {
  process.env.DB_PATH = TMP_DB;
  process.env.APP_USERNAME = 'testadmin';
  // argon2 hash for "testpw"
  process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
});
afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.rmSync(TMP_DB);
});

describe('admin user seeding', () => {
  it('seeds admin user with id, username, hash on first boot', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const db = getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.username, 'testadmin')).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID
    expect(rows[0].passwordHash).toContain('argon2id');
  });

  it('does not duplicate admin user on second boot', async () => {
    const { getDb, schema, closeDb } = await import('@/lib/server/db/client');
    getDb();
    closeDb();
    getDb();
    const db = getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.username, 'testadmin')).all();
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tests/unit/auth-multiuser.test.ts`
Expected: FAIL with "schema.users undefined" 또는 import 에러.

- [ ] **Step 3: schema.ts 에 users 테이블 추가**

`lib/server/db/schema.ts` 맨 위 import 아래:
```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

- [ ] **Step 4: drizzle-kit 으로 마이그레이션 생성**

Run:
```bash
npx drizzle-kit generate --name multi_user_schema
```
Expected: `drizzle/0002_<random>_multi_user_schema.sql` 파일 생성. 그 안에 `CREATE TABLE users` 가 보여야 함. 파일명을 `0002_multi_user_schema.sql` 로 변경 (random 부분 제거).

- [ ] **Step 5: client.ts 에 admin 시딩 로직 추가**

`lib/server/db/client.ts`:
```ts
import argon2 from 'argon2';

const ensureAdminUser = (db: ReturnType<typeof drizzle<typeof schema>>) => {
  const username = process.env.APP_USERNAME ?? 'admin';
  const hash = process.env.APP_PASSWORD_HASH;
  if (!hash) return; // 시딩할 정보가 없으면 skip — 컨테이너 운영자가 CLI 로 추가했을 것

  const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (existing) return;

  const now = new Date().toISOString();
  db.insert(schema.users).values({
    id: ulid(),
    username,
    passwordHash: hash,
    createdAt: now,
    updatedAt: now,
  }).run();
};
```

`getDb()` 안의 `ensureSeed(_db);` 직전에 `ensureAdminUser(_db);` 추가. 또한 `eq` import 추가:
```ts
import { eq } from 'drizzle-orm';
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- tests/unit/auth-multiuser.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/server/db/schema.ts lib/server/db/client.ts drizzle/0002_multi_user_schema.sql drizzle/meta/_journal.json drizzle/meta/0002_snapshot.json tests/unit/auth-multiuser.test.ts
git commit -m "feat(auth): add users table and admin seeding from env"
```

---

## Task 2: 인증을 DB 기반으로 변경

**Goal:** `verifyPassword(plain)` 가 .env 한 쌍과만 비교하던 것을, `verifyCredentials(username, password)` 가 DB users 테이블에서 lookup 하도록 변경. session 에 userId 도 저장.

**Files:**
- Modify: `lib/server/auth.ts`
- Modify: `app/api/auth/login/route.ts`
- Modify: `proxy.ts` (session 검증 시 userId 도 회수해 헤더로 넘김 — Next.js App Router 에서 page/route 가 직접 session 읽으니 헤더 forwarding 은 사실 불필요. proxy 는 그대로.)
- Test: `tests/unit/auth-multiuser.test.ts` (확장)

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/unit/auth-multiuser.test.ts` 끝에 추가:
```ts
import { verifyCredentials } from '@/lib/server/auth';

describe('verifyCredentials', () => {
  it('returns userId for correct username + password', async () => {
    process.env.APP_USERNAME = 'testadmin';
    process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
    process.env.SESSION_SECRET = 'a'.repeat(64);
    const { getDb } = await import('@/lib/server/db/client');
    getDb(); // seeds admin
    const result = await verifyCredentials('testadmin', 'young7983*');
    expect(result).toMatchObject({ userId: expect.any(String), username: 'testadmin' });
  });

  it('returns null for wrong password', async () => {
    process.env.APP_USERNAME = 'testadmin';
    process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
    process.env.SESSION_SECRET = 'a'.repeat(64);
    const { getDb } = await import('@/lib/server/db/client');
    getDb();
    const result = await verifyCredentials('testadmin', 'wrong-password');
    expect(result).toBeNull();
  });

  it('returns null for unknown username', async () => {
    process.env.SESSION_SECRET = 'a'.repeat(64);
    const result = await verifyCredentials('nobody', 'whatever');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/unit/auth-multiuser.test.ts`
Expected: FAIL — `verifyCredentials` not exported.

- [ ] **Step 3: `lib/server/auth.ts` 수정**

전체 교체 (verifyPassword 는 deprecated 로 보존하되 verifyCredentials 추가):
```ts
import 'server-only';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';

export interface SessionData {
  loggedIn?: boolean;
  userId?: string;
  username?: string;
}

const getSessionOptions = (): SessionOptions => {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET env var missing or too short (need ≥32 chars)');
  }
  return {
    password,
    cookieName: 'binder_session',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    },
  };
};

export const getSession = async (): Promise<IronSession<SessionData>> => {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
};

export interface VerifiedCreds {
  userId: string;
  username: string;
}

export const verifyCredentials = async (
  username: string,
  password: string
): Promise<VerifiedCreds | null> => {
  if (!username || !password) return null;
  const db = getDb();
  const row = await db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (!row) return null;
  try {
    const ok = await argon2.verify(row.passwordHash, password);
    if (!ok) return null;
    return { userId: row.id, username: row.username };
  } catch {
    return null;
  }
};

export interface RequiredSession {
  userId: string;
  username: string;
}

export const requireSession = async (): Promise<RequiredSession> => {
  const session = await getSession();
  if (!session.loggedIn || !session.userId || !session.username) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return { userId: session.userId, username: session.username };
};
```

- [ ] **Step 4: `app/api/auth/login/route.ts` 수정**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, verifyCredentials } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요' }, { status: 400 });
  }

  const creds = await verifyCredentials(username, password);
  if (!creds) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않아요' }, { status: 401 });
  }

  const session = await getSession();
  session.loggedIn = true;
  session.userId = creds.userId;
  session.username = creds.username;
  await session.save();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- tests/unit/auth-multiuser.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 6: Commit**

```bash
git add lib/server/auth.ts app/api/auth/login/route.ts tests/unit/auth-multiuser.test.ts
git commit -m "feat(auth): DB-backed credential verification + session userId"
```

---

## Task 3: 도메인 테이블에 nullable `user_id` 컬럼 추가 + 데이터 backfill

**Goal:** 모든 데이터 테이블 (goals, categories, todos, focusNotes, annualGoals, habits, habitLogs, books, retrospectives, timeBlocks) 에 `user_id text` (NULL 허용) 컬럼 추가 후, 기존 모든 행을 admin user 의 id 로 채운다. 마지막으로 `NOT NULL` 강제.

**Files:**
- Modify: `lib/server/db/schema.ts` — 모든 도메인 테이블에 `userId: text('user_id')` (먼저 nullable, 나중 not null)
- Create: `drizzle/0003_add_user_id.sql` (auto-gen)
- Modify: `lib/server/db/client.ts` — `backfillUserId` 함수 추가, migrate 직후 호출
- Create: `drizzle/0004_user_id_not_null.sql` (auto-gen, table rebuild)
- Modify: `lib/types.ts` — 모든 도메인 타입에 `userId: string` 추가

> ⚠️ Drizzle SQLite 의 NOT NULL 추가는 table-rebuild 패턴이 필요. drizzle-kit 이 자동으로 PRAGMA / temp 테이블 패턴을 생성한다.

- [ ] **Step 1: schema.ts 에서 모든 테이블에 nullable user_id 추가**

10개 테이블 각각에 `userId: text('user_id'),` (notNull 빼고) 추가. `settings` 는 다음 task 에서 처리. 예시:
```ts
export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),               // ← 추가
    title: text('title').notNull(),
    // ...
  },
  // ...
);
```
인덱스에 `userIdx: index('goals_user_idx').on(t.userId),` 도 추가.

같은 패턴으로 `categories`, `todos`, `focusNotes`, `annualGoals`, `habits`, `habitLogs`, `books`, `retrospectives`, `timeBlocks` 모두 처리.

- [ ] **Step 2: 마이그레이션 생성**

```bash
npx drizzle-kit generate --name add_user_id
```
Expected: `drizzle/0003_<...>_add_user_id.sql` — 10 ALTER TABLE 추가. 파일명 정리.

- [ ] **Step 3: client.ts 에 backfill 로직 추가**

`lib/server/db/client.ts` 의 `getDb` 안 `migrate` 직후 + `ensureAdminUser` 직후:
```ts
const backfillUserId = (db: ReturnType<typeof drizzle<typeof schema>>) => {
  const adminUsername = process.env.APP_USERNAME ?? 'admin';
  const admin = db.select().from(schema.users).where(eq(schema.users.username, adminUsername)).get();
  if (!admin) return;

  const sqlite = (db as unknown as { $client: Database.Database }).$client;
  const tables = ['goals', 'categories', 'todos', 'focus_notes', 'annual_goals', 'habits', 'habit_logs', 'books', 'retrospectives', 'time_blocks'];
  for (const t of tables) {
    sqlite.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`).run(admin.id);
  }
};
```

`ensureAdminUser(_db);` 직후 `backfillUserId(_db);` 호출.

- [ ] **Step 4: 테스트 — backfill 검증**

`tests/unit/auth-multiuser.test.ts` 에 추가:
```ts
import { goals, categories } from '@/lib/server/db/schema';

it('backfills user_id on all rows for default admin', async () => {
  process.env.APP_USERNAME = 'testadmin';
  process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
  process.env.SESSION_SECRET = 'a'.repeat(64);
  const { getDb, schema } = await import('@/lib/server/db/client');
  const db = getDb();
  // ensureSeed has already inserted 8 default categories
  const cats = await db.select().from(schema.categories).all();
  expect(cats.length).toBeGreaterThan(0);
  for (const c of cats) {
    expect(c.userId).not.toBeNull();
  }
});
```

Run: `npm test -- tests/unit/auth-multiuser.test.ts`
Expected: PASS.

- [ ] **Step 5: schema 에서 user_id 를 NOT NULL 로 변경 + 마이그레이션 생성**

10개 테이블 모두 `userId: text('user_id').notNull(),` 로 변경.

```bash
npx drizzle-kit generate --name user_id_not_null
```
Expected: `drizzle/0004_<...>_user_id_not_null.sql` — table rebuild. drizzle-kit 이 PRAGMA `legacy_alter_table=1` + temp table swap 패턴으로 SQL 생성.

> ⚠️ 만약 drizzle-kit 이 데이터 보존 없는 SQL 을 생성하면 (드물게) 직접 수정. 기존 데이터를 INSERT INTO new SELECT FROM old 로 옮겨야 함.

- [ ] **Step 6: 컨테이너에서 새 마이그레이션 + backfill 검증**

```bash
docker compose up -d --build app
docker compose exec -T app sh -c 'sqlite3 /app/data/binder.sqlite "SELECT COUNT(*) FROM categories WHERE user_id IS NULL"'
```
Expected: `0`

- [ ] **Step 7: lib/types.ts 에 userId 추가**

각 인터페이스 (Goal, Category, Todo, ...) 에 `userId: string;` 필드 추가. type-check 통과 확인:
```bash
npx tsc --noEmit
```
Expected: type errors 가 repo / api 에서 발생할 것 — 이건 Task 5/6 에서 해결. 일단 schema/types 만 일치 확인.

- [ ] **Step 8: Commit**

```bash
git add lib/server/db/schema.ts lib/server/db/client.ts drizzle/0003_*.sql drizzle/0004_*.sql drizzle/meta/ lib/types.ts tests/unit/auth-multiuser.test.ts
git commit -m "feat(db): add user_id to all domain tables + backfill"
```

---

## Task 4: settings 테이블 멀티 유저화

**Goal:** `settings` 가 `key='main'` 단일 행이던 것을, `(userId)` PK 의 per-user 행으로 변경.

**Files:**
- Modify: `lib/server/db/schema.ts` — `settings` 테이블 수정
- Create: `drizzle/0005_settings_per_user.sql`
- Modify: `lib/server/repos/settings.ts` (이건 server repo 는 없고 `lib/server/repos/` 에 settings.ts 가 안 보이므로 `lib/repo/settings.ts` 와 API route 직접 수정 필요. 점검해서 결정)
- Modify: `app/api/settings/route.ts`

> 참고: `lib/server/repos/` 디렉토리 안에 `settings.ts` 가 없다 (점검 결과). settings 는 API route 가 직접 db 를 다룬다. 그대로 인정하고 route 만 수정.

- [ ] **Step 1: 실패 테스트 작성**

`tests/unit/auth-multiuser.test.ts` 추가:
```ts
it('settings is keyed by userId after migration', async () => {
  // ... seed two users (admin + extra), each upsert their settings, verify isolation
});
```

- [ ] **Step 2: 테스트 실패 확인**

Expected: PK 충돌 또는 schema mismatch.

- [ ] **Step 3: schema.ts 수정**

```ts
export const settings = sqliteTable('settings', {
  userId: text('user_id').primaryKey(),
  firstDayOfWeek: text('first_day_of_week').notNull(),
  gridMinutes: integer('grid_minutes').notNull(),
  dayStartHour: integer('day_start_hour').notNull(),
  dayEndHour: integer('day_end_hour').notNull(),
  theme: text('theme').notNull(),
});
```

`key` 컬럼 제거. PK 가 `userId`.

- [ ] **Step 4: 마이그레이션 생성 + manual backfill 추가**

```bash
npx drizzle-kit generate --name settings_per_user
```

생성된 SQL 파일 열어서 `CREATE TABLE __new_settings` 부분 직후 `INSERT INTO __new_settings (...) SELECT ?, ... FROM settings WHERE key='main'` 형태로 admin 유저 user_id 매핑. drizzle-kit 이 SELECT 로 옮기지만 `key` → `userId` 매핑이 자동 안 될 수 있어 SQL 수동 검토.

만약 admin user_id 가 마이그레이션 시점에 SQL 에서 알 수 없으면 (env 접근 불가), `client.ts` 의 backfill 단계에서 처리하도록 마이그레이션은 단순히 새 PK 만 정의하고, 데이터는 코드로 채운다:
```ts
// client.ts backfillUserId 안에서
const oldSettings = sqlite.prepare(`SELECT * FROM settings WHERE rowid = 1`).get();
if (oldSettings && !oldSettings.user_id) {
  sqlite.prepare(`UPDATE settings SET user_id = ? WHERE rowid = 1`).run(admin.id);
}
```
(정확한 패턴은 drizzle-kit 출력 SQL 보고 결정)

- [ ] **Step 5: API route 수정**

`app/api/settings/route.ts` 의 GET / PUT 모두 `requireSession()` 으로 userId 받아 query 의 PK 로 사용.

- [ ] **Step 6: 테스트 통과**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/server/db/schema.ts drizzle/0005_*.sql drizzle/meta/ app/api/settings/route.ts tests/
git commit -m "feat(db): per-user settings table"
```

---

## Task 5: 모든 server repo 메서드에 `userId` 인자 추가

**Goal:** 10개 repo (`lib/server/repos/*.ts`) 의 모든 export 함수가 첫 인자로 `userId: string` 을 받고, 모든 query 에 `eq(t.userId, userId)` 필터 추가.

**Files:**
- Modify: `lib/server/repos/annualGoals.ts`
- Modify: `lib/server/repos/books.ts`
- Modify: `lib/server/repos/categories.ts`
- Modify: `lib/server/repos/focusNotes.ts`
- Modify: `lib/server/repos/goals.ts`
- Modify: `lib/server/repos/habitLogs.ts`
- Modify: `lib/server/repos/habits.ts`
- Modify: `lib/server/repos/retrospectives.ts`
- Modify: `lib/server/repos/timeBlocks.ts`
- Modify: `lib/server/repos/todos.ts`
- Test: `tests/unit/repo-isolation.test.ts` (신규)

- [ ] **Step 1: 격리 검증 테스트 작성**

`tests/unit/repo-isolation.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ulid } from 'ulid';

const TMP_DB = path.join(process.cwd(), 'tmp-test', `iso-${Date.now()}.sqlite`);

beforeEach(() => {
  process.env.DB_PATH = TMP_DB;
  process.env.APP_USERNAME = 'admin';
  process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
  process.env.SESSION_SECRET = 'a'.repeat(64);
});
afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.rmSync(TMP_DB);
});

describe('todo repo isolation', () => {
  it('listTodos for user A does not return user B todos', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const db = getDb();
    const userB = { id: ulid(), username: 'userB', passwordHash: 'x', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db.insert(schema.users).values(userB).run();
    const adminId = (db.select().from(schema.users).where(/* admin */).get() as any).id;

    const { createTodo, listTodos } = await import('@/lib/server/repos/todos');
    await createTodo(adminId, { title: 'admin todo', scope: 'day', scopeKey: '2026-04-28', status: 'pending', order: 0 });
    await createTodo(userB.id, { title: 'B todo', scope: 'day', scopeKey: '2026-04-28', status: 'pending', order: 0 });

    const adminList = await listTodos(adminId, { scope: 'day', scopeKey: '2026-04-28' });
    expect(adminList).toHaveLength(1);
    expect(adminList[0].title).toBe('admin todo');

    const bList = await listTodos(userB.id, { scope: 'day', scopeKey: '2026-04-28' });
    expect(bList).toHaveLength(1);
    expect(bList[0].title).toBe('B todo');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인 (signature mismatch)**

Run: `npm test -- tests/unit/repo-isolation.test.ts`
Expected: type/runtime error — `createTodo(adminId, ...)` 인자 개수 불일치.

- [ ] **Step 3: `lib/server/repos/todos.ts` 수정 (대표 예시)**

전체 교체:
```ts
import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { todos } from '../db/schema';
import { Todo, TodoScope, TodoStatus } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listTodos = async (
  userId: string,
  filters?: { scope?: TodoScope; scopeKey?: string; parentGoalId?: string }
): Promise<Todo[]> => {
  const db = getDb();
  const conds = [eq(todos.userId, userId)];
  if (filters?.scope) conds.push(eq(todos.scope, filters.scope));
  if (filters?.scopeKey) conds.push(eq(todos.scopeKey, filters.scopeKey));
  if (filters?.parentGoalId) conds.push(eq(todos.parentGoalId, filters.parentGoalId));
  const rows = await db.select().from(todos).where(and(...conds)).orderBy(asc(todos.order)).all();
  return rows as Todo[];
};

export const listDayTodosInRange = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<Todo[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(todos)
    .where(and(
      eq(todos.userId, userId),
      eq(todos.scope, 'day'),
      between(todos.scopeKey, startDate, endDate)
    ))
    .orderBy(asc(todos.scopeKey), asc(todos.order))
    .all();
  return rows as Todo[];
};

export const createTodo = async (
  userId: string,
  data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Todo> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Todo = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
  await db.insert(todos).values(row).run();
  return row;
};

export const updateTodo = async (
  userId: string,
  id: string,
  patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>
): Promise<Todo | null> => {
  const db = getDb();
  await db
    .update(todos)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(todos.userId, userId), eq(todos.id, id)))
    .run();
  const row = await db.select().from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.id, id)))
    .get();
  return (row as Todo | undefined) ?? null;
};

export const deleteTodo = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  await db.delete(todos).where(and(eq(todos.userId, userId), eq(todos.id, id))).run();
};

export const setTodoStatus = async (
  userId: string,
  id: string,
  status: TodoStatus
): Promise<Todo | null> => {
  return updateTodo(userId, id, { status });
};

export const toggleTodoDone = async (userId: string, id: string): Promise<Todo | null> => {
  const db = getDb();
  const existing = await db.select().from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.id, id))).get();
  if (!existing) return null;
  const nextStatus: TodoStatus = (existing as Todo).status === 'done' ? 'pending' : 'done';
  return updateTodo(userId, id, { status: nextStatus });
};
```

- [ ] **Step 4: 나머지 9개 repo 동일 패턴으로 수정**

각 repo 파일에 같은 변형 적용:
- 모든 export 함수 첫 인자 `userId: string`
- `listX` 류: `where(and(eq(t.userId, userId), ...))`
- `createX`: `userId` 를 row 에 포함시켜 insert
- `updateX`/`deleteX`: where 에 `eq(t.userId, userId)` 추가
- 외래키 검증 (예: todos 가 categoryId 를 가질 때 그 category 가 같은 user 의 것인지) 는 application 레이어에서 별도 검사 필요시 추가. 우선은 단순 user_id 필터로 격리 보장.

순서: categories → goals → todos → focusNotes → annualGoals → habits → habitLogs → books → retrospectives → timeBlocks.

- [ ] **Step 5: 격리 테스트 통과 + 전체 type-check**

```bash
npm test -- tests/unit/repo-isolation.test.ts
npx tsc --noEmit
```
Expected: 격리 테스트 PASS. type-check 는 API route 측 인자 mismatch 가 남아 있을 것 — 다음 task 에서 해결.

- [ ] **Step 6: Commit**

```bash
git add lib/server/repos/ tests/unit/repo-isolation.test.ts
git commit -m "feat(repos): require userId on all repo methods + isolation test"
```

---

## Task 6: 모든 API route 에서 session.userId 전달

**Goal:** 24개 route handler 가 `requireSession()` 을 호출해 userId 를 얻고, repo 호출 시 첫 인자로 전달. body 에 들어온 userId 는 무시 (서버 신뢰).

**Files:**
- Modify: `app/api/*/route.ts` × 24
- 단순 패턴이라 한 commit 으로 batch 처리.

대표 예시 — `app/api/todos/route.ts`:

- [ ] **Step 1: 한 route 수정 (대표)**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listTodos, createTodo } from '@/lib/server/repos/todos';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const url = req.nextUrl;
  const scope = url.searchParams.get('scope') as 'day' | 'week' | 'month' | 'year' | null;
  const scopeKey = url.searchParams.get('scopeKey');
  const parentGoalId = url.searchParams.get('parentGoalId');
  const todos = await listTodos(session.userId, {
    scope: scope ?? undefined,
    scopeKey: scopeKey ?? undefined,
    parentGoalId: parentGoalId ?? undefined,
  });
  return NextResponse.json(todos);
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = await req.json();
  const created = await createTodo(session.userId, body);
  return NextResponse.json(created, { status: 201 });
}
```

> 패턴: try/catch 로 requireSession 의 throw 한 Response 를 반환하는 게 핵심. App Router 에선 throw Response 를 자동 응답으로 못 변환하므로 직접 returns.

- [ ] **Step 2: 나머지 23개 route 동일 패턴**

각 route 의 GET/POST/PUT/PATCH/DELETE 에 위 패턴 적용. `[id]/route.ts` 들도 마찬가지로 `params.id` 와 `session.userId` 둘 다 repo 에 전달.

특수 케이스:
- `app/api/auth/login/route.ts` — 이미 Task 2 에서 처리
- `app/api/auth/logout/route.ts` — session.destroy 로 충분, repo 호출 없음
- `app/api/export/route.ts` — admin user 의 모든 데이터 export. **session.userId 의 데이터만** 으로 변경
- `app/api/import/route.ts` — body 의 user_id 가 어떤 값이어도 무시하고 session.userId 로 강제 덮어쓰기
- `app/api/progress/route.ts` — repo 들을 묶어 호출하므로 모두 userId 전달

- [ ] **Step 3: 컨테이너 띄워 smoke test**

```bash
docker compose up -d --build app
curl -c cookies.txt -b cookies.txt -X POST https://young538.iptime.org/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"young538","password":"young7983*"}' --insecure
# expect {"ok":true}
curl -b cookies.txt https://young538.iptime.org/api/categories --insecure
# expect array of admin's 8 categories
```

- [ ] **Step 4: 전체 unit test 통과 + e2e 테스트는 Task 8/9 에서 갱신**

```bash
npm test
```
Expected: 격리 테스트, auth multiuser PASS. 기존 aggregate/date/mandalart 테스트는 schema 변경 영향 없으면 PASS. 영향 있으면 fixture 에 userId 추가.

- [ ] **Step 5: Commit**

```bash
git add app/api/
git commit -m "feat(api): pass session userId to all repo calls"
```

---

## Task 7: 사용자별 categories seed (per-user 시딩)

**Goal:** 신규 사용자가 추가될 때 기본 8개 categories 가 자동으로 시딩되도록. 현재는 글로벌 시딩이라 admin 의 것만 존재.

**Files:**
- Modify: `lib/server/db/client.ts` — `ensureCategoriesForUser(userId)` 함수 추가
- Modify: Task 8 의 CLI 에서 사용자 추가 후 호출

- [ ] **Step 1: 테스트 작성**

`tests/unit/auth-multiuser.test.ts`:
```ts
it('seeds 8 default categories when a new user is created', async () => {
  const { getDb, schema, ensureCategoriesForUser } = await import('@/lib/server/db/client');
  const db = getDb();
  const newUser = { id: ulid(), username: 'fresh', passwordHash: 'x', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.insert(schema.users).values(newUser).run();
  ensureCategoriesForUser(newUser.id);
  const cats = await db.select().from(schema.categories).where(eq(schema.categories.userId, newUser.id)).all();
  expect(cats).toHaveLength(8);
});
```

- [ ] **Step 2: 실패 확인 + 구현**

`lib/server/db/client.ts`:
```ts
export const ensureCategoriesForUser = (userId: string) => {
  const db = getDb();
  const existing = db.select().from(schema.categories).where(eq(schema.categories.userId, userId)).get();
  if (existing) return;
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({ id: ulid(), userId, order: i, ...c }));
  db.insert(schema.categories).values(rows).run();
};
```

`ensureSeed` 는 모든 user 한 번만 시딩하던 글로벌 함수였다 — 이 함수를 `ensureCategoriesForUser(adminId)` 호출로 대체. 즉:
```ts
// getDb 안:
ensureAdminUser(_db);
backfillUserId(_db);
const admin = ... // get admin row
ensureCategoriesForUser(admin.id);
```

- [ ] **Step 3: 테스트 PASS 확인**

- [ ] **Step 4: Commit**

```bash
git add lib/server/db/client.ts tests/unit/auth-multiuser.test.ts
git commit -m "feat(db): seed default categories per user"
```

---

## Task 8: 사용자 관리 CLI (`scripts/users.mjs`)

**Goal:** 사용자 추가 / 목록 / 비밀번호 변경 / 삭제 가능한 CLI. 컨테이너 안에서 `docker compose exec app node scripts/users.mjs <subcommand>` 형태로 운영.

**Files:**
- Create: `scripts/users.mjs`

- [ ] **Step 1: 스크립트 작성**

```mjs
#!/usr/bin/env node
import argon2 from 'argon2';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'binder.sqlite');
const DEFAULT_CATEGORIES = [
  { name: '주원씽', color: '#f4cccc' },
  { name: '부원씽', color: '#fce5cd' },
  { name: '강의',   color: '#fff2cc' },
  { name: '개인',   color: '#d9ead3' },
  { name: '성장',   color: '#c9daf8' },
  { name: '사람',   color: '#d9d2e9' },
  { name: '재미',   color: '#ead1dc' },
  { name: '낭비',   color: '#d9d9d9' },
];

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const [, , cmd, ...args] = process.argv;

const usage = () => {
  console.error('Usage:');
  console.error('  node scripts/users.mjs add <username> <password>');
  console.error('  node scripts/users.mjs list');
  console.error('  node scripts/users.mjs passwd <username> <new-password>');
  console.error('  node scripts/users.mjs delete <username>');
  process.exit(1);
};

if (cmd === 'add') {
  const [username, password] = args;
  if (!username || !password) usage();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) { console.error(`User '${username}' already exists`); process.exit(2); }
  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const id = ulid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)')
    .run(id, username, hash, now, now);
  // seed default categories
  const insertCat = db.prepare('INSERT INTO categories (id, user_id, name, color, "order") VALUES (?,?,?,?,?)');
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    insertCat.run(ulid(), id, DEFAULT_CATEGORIES[i].name, DEFAULT_CATEGORIES[i].color, i);
  }
  console.log(`Added user '${username}' (id=${id}) with 8 default categories`);
} else if (cmd === 'list') {
  const rows = db.prepare('SELECT id, username, created_at FROM users ORDER BY created_at').all();
  for (const r of rows) console.log(`${r.id}\t${r.username}\t${r.created_at}`);
} else if (cmd === 'passwd') {
  const [username, newPassword] = args;
  if (!username || !newPassword) usage();
  const hash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const result = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?')
    .run(hash, new Date().toISOString(), username);
  if (result.changes === 0) { console.error(`User '${username}' not found`); process.exit(2); }
  console.log(`Password updated for '${username}'`);
} else if (cmd === 'delete') {
  const [username] = args;
  if (!username) usage();
  // CASCADE: delete user's data first
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) { console.error(`User '${username}' not found`); process.exit(2); }
  const tables = ['goals', 'categories', 'todos', 'focus_notes', 'annual_goals', 'habits', 'habit_logs', 'books', 'retrospectives', 'time_blocks', 'settings'];
  const tx = db.transaction(() => {
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(user.id);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });
  tx();
  console.log(`Deleted user '${username}' and all their data`);
} else {
  usage();
}

db.close();
```

- [ ] **Step 2: 컨테이너 안에서 dry-run**

```bash
docker compose exec -T app node scripts/users.mjs list
# expect young538 row
```

- [ ] **Step 3: Commit**

```bash
git add scripts/users.mjs
git commit -m "feat(cli): scripts/users.mjs for add/list/passwd/delete"
```

---

## Task 9: 기존 unit test 정상화

**Goal:** schema 변경으로 깨졌을 가능성이 있는 기존 unit test (`aggregate.test.ts` 등) 가 fixture 에서 userId 를 사용하도록 갱신. 모든 unit test 가 PASS 해야 진행.

**Files:**
- Modify: `tests/unit/aggregate.test.ts`
- Modify: `tests/unit/aggregate-todos.test.ts`
- (date.test.ts, mandalart.test.ts 는 DB 무관일 가능성 높지만 점검)

- [ ] **Step 1: 모든 test 실행 → 깨진 것 식별**

```bash
npm test 2>&1 | tee test.log
```

- [ ] **Step 2: 깨진 테스트 마다 fixture 에 userId 추가**

각 test 의 sample data 빌더에 `userId: 'test-user-id'` 를 채우고, 필요하다면 같은 user id 를 repo 호출에 전달.

- [ ] **Step 3: 모두 PASS 확인**

```bash
npm test
```
Expected: ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/
git commit -m "test: update fixtures with userId"
```

---

## Task 10: E2E 격리 테스트

**Goal:** Playwright 로 두 사용자가 같은 인스턴스에서 각자 todo 를 만들고, 서로의 데이터를 보지 못함을 검증.

**Files:**
- Modify: `tests/e2e/_helpers.ts` — 두 번째 user 시딩 헬퍼
- Create: `tests/e2e/multiuser.spec.ts`
- 기존 4개 e2e spec 의 login 헬퍼는 admin 만 사용하므로 영향 없음 (재확인)

- [ ] **Step 1: helper 확장**

```ts
// tests/e2e/_helpers.ts 추가
export async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name=username]', username);
  await page.fill('input[name=password]', password);
  await page.click('button[type=submit]');
  await expect(page).not.toHaveURL(/\/login/);
}

export async function ensureUserExists(username: string, password: string) {
  // shell out to scripts/users.mjs add — only effective in the test container
  const { execSync } = await import('node:child_process');
  try {
    execSync(`node scripts/users.mjs add ${username} ${password}`, { stdio: 'pipe' });
  } catch (e) {
    // already exists is fine
  }
}
```

- [ ] **Step 2: spec 작성**

```ts
import { test, expect } from '@playwright/test';
import { loginAs, ensureUserExists } from './_helpers';

test.describe('multi-user isolation', () => {
  test.beforeAll(async () => {
    await ensureUserExists('userA', 'passwordA1*');
    await ensureUserExists('userB', 'passwordB1*');
  });

  test('userA cannot see userB todos', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await loginAs(pageA, 'userA', 'passwordA1*');
    await pageA.goto('/week');
    await pageA.fill('input[placeholder*=오늘]', 'A의 할일');
    await pageA.press('input[placeholder*=오늘]', 'Enter');
    await expect(pageA.locator('text=A의 할일')).toBeVisible();

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await loginAs(pageB, 'userB', 'passwordB1*');
    await pageB.goto('/week');
    await expect(pageB.locator('text=A의 할일')).not.toBeVisible();
  });
});
```

- [ ] **Step 3: 실행**

```bash
npx playwright test tests/e2e/multiuser.spec.ts
```
Expected: PASS.

- [ ] **Step 4: 기존 e2e 4개도 PASS 검증**

```bash
npx playwright test
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/
git commit -m "test(e2e): user isolation across browser contexts"
```

---

## Task 11: 프로덕션 적용 + leemia79 추가

**Goal:** 모든 변경을 main 에 push 한 뒤, 운영 컨테이너 재배포 + leemia79 사용자 추가 + 동작 확인.

- [ ] **Step 1: main push**

```bash
git push origin main
```

- [ ] **Step 2: 운영 컨테이너 재배포 — DB 백업 먼저**

```bash
$date = Get-Date -Format "yyyyMMdd-HHmm"
New-Item -ItemType Directory -Force backups | Out-Null
Copy-Item "data\binder.sqlite*" "backups\" -Force
docker compose up -d --build app
docker compose logs --tail 50 app
```

마이그레이션 자동 적용 + admin 시딩 + backfill 로그 확인.

- [ ] **Step 3: 로그인 동작 확인 (young538)**

브라우저로 https://young538.iptime.org → 기존 비밀번호로 로그인 → 기존 데이터 모두 보이는지 확인. **이 시점에 기존 데이터가 안 보이면 즉시 backups 에서 복원하고 수정 작업.**

- [ ] **Step 4: leemia79 추가**

```bash
docker compose exec -T app node scripts/users.mjs add leemia79 'young7983*'
docker compose exec -T app node scripts/users.mjs list
```

- [ ] **Step 5: leemia79 로 로그인 → 빈 데이터 확인**

브라우저에서 leemia79 로 로그인 → categories 8개 (default) 제외 모두 빈 상태여야 함. 새 todo 만들고 → 로그아웃 → young538 로 다시 로그인 → leemia79 의 todo 안 보이는지 최종 검증.

- [ ] **Step 6: RUNBOOK.md 업데이트**

`docs/RUNBOOK.md` 의 "알려진 보안 한계" 섹션에서 "**단일 사용자**" 줄 제거, 사용자 관리 섹션 추가:
```md
### 사용자 추가 / 비번 변경 / 삭제

docker compose exec -T app node scripts/users.mjs add <username> <password>
docker compose exec -T app node scripts/users.mjs passwd <username> <new-password>
docker compose exec -T app node scripts/users.mjs delete <username>
docker compose exec -T app node scripts/users.mjs list
```

- [ ] **Step 7: 최종 commit + push**

```bash
git add docs/RUNBOOK.md
git commit -m "docs(runbook): document multi-user CLI"
git push origin main
```

---

## 종합 체크리스트 (실행 시 순서대로)

1. ☐ Task 1 — users 테이블 + admin 시딩
2. ☐ Task 2 — DB 기반 인증
3. ☐ Task 3 — 도메인 테이블 user_id (nullable → backfill → not null)
4. ☐ Task 4 — settings per-user
5. ☐ Task 5 — repo userId 인자
6. ☐ Task 6 — API route 에서 session.userId 전달
7. ☐ Task 7 — categories per-user seed
8. ☐ Task 8 — CLI scripts/users.mjs
9. ☐ Task 9 — 기존 unit test 갱신
10. ☐ Task 10 — E2E 격리 테스트
11. ☐ Task 11 — 운영 배포 + leemia79 추가

## 예상 소요 시간

- 단일 세션 inline 실행: 4~6시간 (TDD + 검증 포함)
- subagent-driven (별도 세션 per task): 8~12시간 (검토/리뷰 포함, 더 안전)

## 위험 요소

1. **데이터 손실** — Task 3 의 backfill 이 잘못되면 기존 데이터가 admin 에 매핑 안 됨. 항상 Task 11 직전 백업.
2. **외래키 무결성** — `goals.parentId`, `todos.parentGoalId` 등 self/cross 참조가 cross-user 가 되지 않도록 application 검증 추가 필요할 수 있음 (현재 plan 은 단순 user_id 필터링만 하므로 악의적으로 cross-user id 를 body 에 넣어 update 하면 일부 케이스에서 leak 가능). Task 6 의 update 패턴이 `where(and(userId, id))` 을 항상 적용하므로 다른 사용자 row 는 영향 못 받음 — 기본은 안전. 외래키 leak 은 리얼 위협이라 별도 audit task 추가 가능.
3. **마이그레이션 SQL 의 자동생성 한계** — drizzle-kit 의 SQLite NOT NULL 변경 SQL 이 데이터 보존을 보장하지 않을 수 있음. Task 3 Step 5 에서 SQL 직접 검토 필수.
4. **세션 무효화** — schema 변경 후 기존 세션 쿠키에는 userId 가 없을 것. 사용자가 한 번 강제 로그인 → 정상 세션 만들어야 함. UX 영향 있음 — RUNBOOK 에 "배포 후 모든 사용자 재로그인 필요" 명시.

---

## 변경 이력

- 2026-04-28 — 작성. 결정사항 default 로 가정한 v1.

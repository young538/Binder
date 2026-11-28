// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractWikiLinks,
  parseFrontmatter,
  resolveWikiLink,
  sanitizeRawSlug,
} from '@/lib/wiki';
import { WikiService, resolveSafeWikiPath } from '@/lib/server/wiki/service';
import { DomainError } from '@/lib/server/errors';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'binder-wiki-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('wiki parsing, security, multi-user isolation & indexing', () => {
  it('parses frontmatter, inline wikilinks (ignoring code blocks), and resolves targets cleanly', () => {
    const raw = `---
title: 테스트 위키
category: topics
tags: [재무, 독서]
updated: 2026-11-28
summary: 요약 텍스트
sources:
  - raw/inbox/sample.md
---

# 테스트 위키

본문에서 [[목표-문서]]와 [[wiki/life/원칙|내 원칙]]을 연결합니다.

\`\`\`md
[[코드블록-무시]]
\`\`\`
`;
    const parsed = parseFrontmatter(raw);
    expect(parsed.data).toMatchObject({
      title: '테스트 위키',
      category: 'topics',
      tags: ['재무', '독서'],
      updated: '2026-11-28',
      summary: '요약 텍스트',
      sources: ['raw/inbox/sample.md'],
    });
    expect(parsed.body).toContain('[[목표-문서]]');

    const links = extractWikiLinks(parsed.body);
    expect(links).toEqual([
      { target: '목표-문서', label: '목표-문서' },
      { target: 'wiki/life/원칙', label: '내 원칙' },
    ]);

    const pages = [
      { path: 'wiki/topics/목표-문서.md', slug: '목표-문서', title: '목표 문서' },
      { path: 'wiki/life/원칙.md', slug: '원칙', title: '내 원칙' },
    ];
    expect(resolveWikiLink('목표-문서', pages)).toBe('wiki/topics/목표-문서.md');
    expect(resolveWikiLink('wiki/life/원칙', pages)).toBe('wiki/life/원칙.md');
    expect(resolveWikiLink('내 원칙', pages)).toBe('wiki/life/원칙.md');
    expect(resolveWikiLink('없는-문서', pages)).toBeNull();
    expect(sanitizeRawSlug('주식 밸류에이션 강의!!')).toBe('주식-밸류에이션-강의');
  });

  it('blocks path traversal, null bytes, backslashes, hidden directories, and non-wiki targets', () => {
    expect(() => resolveSafeWikiPath(tempDir, '../etc/passwd', 'read')).toThrow(DomainError);
    expect(() => resolveSafeWikiPath(tempDir, 'wiki/../../secret.md', 'read')).toThrow(DomainError);
    expect(() => resolveSafeWikiPath(tempDir, '.users/other/index.md', 'read')).toThrow(DomainError);
    expect(() => resolveSafeWikiPath(tempDir, 'wiki/.hidden.md', 'read')).toThrow(DomainError);
    expect(() => resolveSafeWikiPath(tempDir, 'wiki\\test.md', 'read')).toThrow(DomainError);
    expect(() => resolveSafeWikiPath(tempDir, 'package.json', 'read')).toThrow(DomainError);
    expect(() => resolveSafeWikiPath(tempDir, 'wiki/a.md', 'raw-write')).toThrow(DomainError);

    expect(resolveSafeWikiPath(tempDir, 'index.md', 'read')).toBe(path.join(tempDir, 'index.md'));
    expect(resolveSafeWikiPath(tempDir, 'wiki/topics/alpha.md', 'read')).toBe(
      path.join(tempDir, 'wiki', 'topics', 'alpha.md'),
    );
  });

  it('indexes backlinks/orphans/broken links, captures raw notes & files, searches, and isolates users', () => {
    process.env.WIKI_OWNER_USERNAME = 'owner-user';
    const owner = new WikiService('uid-owner', 'owner-user', tempDir);
    const other = new WikiService('uid-other', 'other-user', tempDir);

    // Empty initial state
    expect(owner.getIndex()).toMatchObject({ initialized: false, pages: [], rawFiles: [] });

    // Populate owner wiki
    fs.mkdirSync(path.join(tempDir, 'wiki', 'life'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'wiki', 'topics'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'index.md'),
      '# 목차\n- [[목표-노트]]\n- [[고아-아님]]\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(tempDir, 'log.md'),
      '# Log\n## [2026-11-28] ingest | 초기 구축\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(tempDir, 'wiki', 'life', '목표-노트.md'),
      `---
title: 목표 노트
category: life
tags: [목표, 핵심]
updated: 2026-11-28
summary: 핵심 목표 요약
---

[[고아-아님]] 과 [[없는-페이지]] 를 참조합니다.
`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(tempDir, 'wiki', 'topics', '고아-아님.md'),
      '---\ntitle: 고아 아님\ncategory: topics\nupdated: 2026-11-28\n---\n본문입니다.\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(tempDir, 'wiki', 'topics', '고아-페이지.md'),
      '---\ntitle: 고아 페이지\ncategory: topics\nupdated: 2026-11-28\n---\n어디에서도 링크 안 됨\n',
      'utf8',
    );

    const idx = owner.getIndex();
    expect(idx.initialized).toBe(true);
    expect(idx.stats.totalPages).toBe(3);
    expect(idx.stats.brokenLinkCount).toBe(1);
    expect(idx.stats.orphanCount).toBe(1);
    expect(idx.recentLogs[0]).toMatchObject({ date: '2026-11-28', kind: 'ingest' });

    const targetDetail = owner.getPage('wiki/topics/고아-아님.md');
    expect(targetDetail.backlinks.map(b => b.path).sort()).toEqual([
      'index.md',
      'wiki/life/목표-노트.md',
    ]);

    // Capture raw note + upload file
    const noteFile = owner.captureRawNote({
      title: '투자 메모',
      content: '가치투자 핵심 정리',
      sourceUrl: 'https://example.com/article',
      tags: ['투자', '독서'],
    });
    expect(noteFile.path).toMatch(/^raw\/inbox\/\d{4}-\d{2}-\d{2}-\d{6}-투자-메모\.md$/);
    expect(owner.getPage(noteFile.path).isRaw).toBe(true);

    const uploaded = owner.uploadRawFile({
      fileName: 'report.pdf',
      buffer: Buffer.from('%PDF-1.4 dummy'),
    });
    expect(uploaded.previewable).toBe(false);
    expect(() =>
      owner.uploadRawFile({ fileName: 'malware.exe', buffer: Buffer.from('x') }),
    ).toThrow(DomainError);

    // Search hits compiled pages cleanly
    const hits = owner.search('핵심');
    expect(hits.some(h => h.href.includes(encodeURIComponent('wiki/life/목표-노트.md')))).toBe(
      true,
    );

    // User isolation: 'other' sees nothing from owner and gets own isolated dir
    expect(other.getIndex().initialized).toBe(false);
    other.captureRawNote({ title: '다른 사용자 메모', content: '개인 내용' });
    expect(other.getIndex().stats.rawInboxCount).toBe(1);
    expect(owner.getIndex().stats.rawInboxCount).toBe(2);
    expect(other.search('목표 노트')).toHaveLength(0);
  });
});

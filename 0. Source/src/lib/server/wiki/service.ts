import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { format } from 'date-fns';
import {
  extractWikiLinks,
  parseFrontmatter,
  resolveWikiLink,
  sanitizeRawSlug,
  stripMarkdownTitleHeading,
  WIKI_CATEGORY_LABEL,
  type WikiCategory,
  type WikiGraphData,
  type WikiGraphEdge,
  type WikiGraphNode,
  type WikiIndexResponse,
  type WikiLogEntry,
  type WikiPageDetail,
  type WikiPageSummary,
  type WikiRawFile,
} from '@/lib/wiki';
import { SEARCH_PAGE_SIZE, type SearchResult } from '@/lib/search/types';
import { DomainError } from '../errors';

const META_FILES = ['index.md', 'SCHEMA.md', 'log.md'] as const;
const MAX_RAW_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_RAW_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.pdf',
  '.csv',
  '.xlsx',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);
const PREVIEWABLE_RAW_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json']);
const WIKI_SUBDIRS: WikiCategory[] = ['life', 'topics', 'sources', 'synthesis'];

interface ParsedDiskPage {
  summary: WikiPageSummary;
  rawMarkdown: string;
  body: string;
  rawLinks: { target: string; label: string }[];
}

function asString(val: string | string[] | undefined): string | null {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed || null;
  }
  if (Array.isArray(val) && val.length > 0) {
    return val.join(', ');
  }
  return null;
}

function asStringArray(val: string | string[] | undefined): string[] {
  if (Array.isArray(val)) return val.map(v => v.trim()).filter(Boolean);
  if (typeof val === 'string' && val.trim()) {
    return val
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function countWords(text: string): number {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

function walkFiles(dir: string, root: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, root, out);
    } else if (entry.isFile()) {
      out.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

function parseLogEntries(markdown: string, limit = 15): WikiLogEntry[] {
  const entries: WikiLogEntry[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^##\s+\[(\d{4}-\d{2}-\d{2})\]\s*([a-zA-Z가-힣_-]+)?\s*\|\s*(.+)$/.exec(
      line.trim(),
    );
    if (m) {
      entries.push({
        heading: line.trim(),
        date: m[1],
        kind: (m[2] ?? '').trim() || null,
        summary: m[3].trim(),
      });
    }
  }
  return entries.slice(-limit).reverse();
}

export function resolveSafeWikiPath(
  root: string,
  relPath: string,
  mode: 'read' | 'raw-write',
): string {
  if (!relPath || typeof relPath !== 'string') {
    throw new DomainError('올바른 위키 경로가 필요합니다.', 400);
  }
  if (relPath.includes('\0') || relPath.includes('\\')) {
    throw new DomainError('허용되지 않는 위키 경로입니다.', 400);
  }
  const normalized = relPath.replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some(seg => seg === '.' || seg === '..' || seg.startsWith('.'))
  ) {
    throw new DomainError('허용되지 않는 위키 경로입니다.', 400);
  }

  const joined = segments.join('/');
  if (mode === 'raw-write') {
    if (!joined.startsWith('raw/inbox/') || segments.length !== 3) {
      throw new DomainError('Raw 저장은 raw/inbox/ 경로만 허용됩니다.', 400);
    }
  } else {
    const isMeta = (META_FILES as readonly string[]).includes(joined);
    const isWikiMd = joined.startsWith('wiki/') && joined.toLowerCase().endsWith('.md');
    const isRaw = joined.startsWith('raw/') && segments.length >= 2;
    if (!isMeta && !isWikiMd && !isRaw) {
      throw new DomainError('접근할 수 없는 위키 경로입니다.', 400);
    }
  }

  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, ...segments);
  const relFromRoot = path.relative(resolvedRoot, resolvedTarget);
  if (!relFromRoot || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    throw new DomainError('위키 루트를 벗어난 경로입니다.', 400);
  }

  if (fs.existsSync(resolvedRoot)) {
    const realRoot = fs.realpathSync(resolvedRoot);
    if (fs.existsSync(resolvedTarget)) {
      const realTarget = fs.realpathSync(resolvedTarget);
      if (
        realTarget !== realRoot &&
        !realTarget.startsWith(`${realRoot}${path.sep}`)
      ) {
        throw new DomainError('심볼릭 링크가 위키 루트를 벗어납니다.', 400);
      }
    }
  }

  return resolvedTarget;
}

export class WikiService {
  readonly baseDir: string;
  readonly rootDir: string;

  constructor(
    private readonly userId: string,
    private readonly username?: string | null,
    baseDirOverride?: string,
  ) {
    this.baseDir = path.resolve(
      baseDirOverride ||
        process.env.WIKI_DIR ||
        path.resolve(process.cwd(), '..', '2. Wiki'),
    );
    const owner = process.env.WIKI_OWNER_USERNAME?.trim();
    if (owner && this.username && this.username === owner) {
      this.rootDir = this.baseDir;
    } else {
      const safeUserId = this.userId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'anon';
      this.rootDir = path.join(this.baseDir, '.users', safeUserId);
    }
  }

  private collectPages(): {
    parsedPages: ParsedDiskPage[];
    rawFiles: WikiRawFile[];
    recentLogs: WikiLogEntry[];
    brokenLinkCount: number;
    orphanCount: number;
    graph: WikiGraphData;
  } {
    if (!fs.existsSync(this.rootDir)) {
      return {
        parsedPages: [],
        rawFiles: [],
        recentLogs: [],
        brokenLinkCount: 0,
        orphanCount: 0,
        graph: { nodes: [], edges: [] },
      };
    }

    const parsedPages: ParsedDiskPage[] = [];
    let recentLogs: WikiLogEntry[] = [];

    // 1. Meta files (index.md, SCHEMA.md, log.md)
    for (const metaName of META_FILES) {
      const abs = path.join(this.rootDir, metaName);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
      const rawMarkdown = fs.readFileSync(abs, 'utf8');
      if (metaName === 'log.md') {
        recentLogs = parseLogEntries(rawMarkdown);
      }
      const stat = fs.statSync(abs);
      const { data, body } = parseFrontmatter(rawMarkdown);
      const title =
        asString(data.title) ??
        stripMarkdownTitleHeading(body) ??
        metaName.replace(/\.md$/i, '');
      const summary =
        asString(data.summary) ??
        (metaName === 'index.md'
          ? '위키 전체 목차'
          : metaName === 'log.md'
            ? 'Ingest · Query · Lint 작업 기록'
            : 'LLM Wiki 운영 규칙');
      parsedPages.push({
        summary: {
          path: metaName,
          slug: metaName.replace(/\.md$/i, ''),
          title,
          category: 'meta',
          tags: asStringArray(data.tags),
          updated: asString(data.updated) ?? stat.mtime.toISOString().slice(0, 10),
          summary,
          sources: asStringArray(data.sources),
          outgoingCount: 0,
          backlinkCount: 0,
          wordCount: countWords(body),
        },
        rawMarkdown,
        body,
        rawLinks: extractWikiLinks(body),
      });
    }

    // 2. Compiled wiki pages (wiki/**/*.md)
    const wikiRelPaths = walkFiles(path.join(this.rootDir, 'wiki'), this.rootDir)
      .filter(p => p.toLowerCase().endsWith('.md'))
      .sort();

    for (const rel of wikiRelPaths) {
      const abs = resolveSafeWikiPath(this.rootDir, rel, 'read');
      const rawMarkdown = fs.readFileSync(abs, 'utf8');
      const stat = fs.statSync(abs);
      const { data, body } = parseFrontmatter(rawMarkdown);
      const segs = rel.split('/');
      const folderCat = segs[1] as WikiCategory;
      const fmCat = asString(data.category) as WikiCategory | null;
      const category: WikiCategory =
        fmCat && WIKI_SUBDIRS.includes(fmCat)
          ? fmCat
          : WIKI_SUBDIRS.includes(folderCat)
            ? folderCat
            : 'topics';
      const slug = path.basename(rel, '.md');
      const title = asString(data.title) ?? stripMarkdownTitleHeading(body) ?? slug;
      const summary = asString(data.summary) ?? '';
      parsedPages.push({
        summary: {
          path: rel,
          slug,
          title,
          category,
          tags: asStringArray(data.tags),
          updated: asString(data.updated) ?? stat.mtime.toISOString().slice(0, 10),
          summary,
          sources: asStringArray(data.sources),
          outgoingCount: 0,
          backlinkCount: 0,
          wordCount: countWords(body),
        },
        rawMarkdown,
        body,
        rawLinks: extractWikiLinks(body),
      });
    }

    // 3. Resolve outgoing links, backlinks & graph edges/nodes
    const summaryPool = parsedPages.map(p => p.summary);
    const backlinkCounts = new Map<string, number>();
    const edgeSet = new Set<string>();
    const edges: WikiGraphEdge[] = [];
    const missingNodes = new Map<string, WikiGraphNode>();
    let brokenLinkCount = 0;

    for (const page of parsedPages) {
      let outCount = 0;
      const seenResolved = new Set<string>();
      for (const link of page.rawLinks) {
        const targetPath = resolveWikiLink(link.target, summaryPool);
        if (!targetPath) {
          brokenLinkCount++;
          const missingKey = link.target.trim().toLowerCase();
          if (missingKey) {
            const missingId = `missing:${missingKey}`;
            if (!missingNodes.has(missingId)) {
              missingNodes.set(missingId, {
                id: missingId,
                label: link.target.trim(),
                category: 'unresolved',
                summary: '아직 작성되지 않은 위키 문서',
                tags: [],
                degree: 0,
                backlinkCount: 0,
                outgoingCount: 0,
                isOrphan: false,
                unresolved: true,
              });
            }
            const ek = `${page.summary.path}->${missingId}`;
            if (!edgeSet.has(ek)) {
              edgeSet.add(ek);
              edges.push({ source: page.summary.path, target: missingId, resolved: false });
            }
          }
          continue;
        }
        outCount++;
        if (targetPath !== page.summary.path && !seenResolved.has(targetPath)) {
          seenResolved.add(targetPath);
          backlinkCounts.set(targetPath, (backlinkCounts.get(targetPath) ?? 0) + 1);
          const ek = `${page.summary.path}->${targetPath}`;
          if (!edgeSet.has(ek)) {
            edgeSet.add(ek);
            edges.push({ source: page.summary.path, target: targetPath, resolved: true });
          }
        }
      }
      page.summary.outgoingCount = outCount;
    }

    let orphanCount = 0;
    for (const page of parsedPages) {
      const incoming = backlinkCounts.get(page.summary.path) ?? 0;
      page.summary.backlinkCount = incoming;
      if (page.summary.category !== 'meta' && incoming === 0) {
        orphanCount++;
      }
    }

    const degreeCounts = new Map<string, number>();
    for (const edge of edges) {
      degreeCounts.set(edge.source, (degreeCounts.get(edge.source) ?? 0) + 1);
      degreeCounts.set(edge.target, (degreeCounts.get(edge.target) ?? 0) + 1);
    }

    const graphNodes: WikiGraphNode[] = [
      ...parsedPages.map(p => ({
        id: p.summary.path,
        label: p.summary.title,
        category: p.summary.category,
        summary: p.summary.summary,
        tags: p.summary.tags,
        degree: degreeCounts.get(p.summary.path) ?? 0,
        backlinkCount: p.summary.backlinkCount,
        outgoingCount: p.summary.outgoingCount,
        isOrphan: p.summary.category !== 'meta' && p.summary.backlinkCount === 0,
      })),
      ...[...missingNodes.values()].map(m => ({
        ...m,
        degree: degreeCounts.get(m.id) ?? 0,
      })),
    ];

    // 4. Raw files (raw/inbox/* & raw/life-os/**)
    const rawRelPaths = walkFiles(path.join(this.rootDir, 'raw'), this.rootDir).sort();
    const rawFiles: WikiRawFile[] = rawRelPaths.map(rel => {
      const abs = resolveSafeWikiPath(this.rootDir, rel, 'read');
      const stat = fs.statSync(abs);
      const ext = path.extname(rel).toLowerCase();
      return {
        path: rel,
        name: path.basename(rel),
        folder: rel.startsWith('raw/inbox/') ? 'inbox' : 'life-os',
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        previewable: PREVIEWABLE_RAW_EXTENSIONS.has(ext),
      };
    });

    return {
      parsedPages,
      rawFiles,
      recentLogs,
      brokenLinkCount,
      orphanCount,
      graph: { nodes: graphNodes, edges },
    };
  }

  getIndex(): WikiIndexResponse {
    const { parsedPages, rawFiles, recentLogs, brokenLinkCount, orphanCount, graph } =
      this.collectPages();
    const pages = parsedPages.map(p => p.summary);
    const dates = pages
      .map(p => p.updated)
      .filter((d): d is string => Boolean(d))
      .sort();

    return {
      initialized: pages.length > 0 || rawFiles.length > 0,
      pages,
      rawFiles,
      stats: {
        totalPages: pages.filter(p => p.category !== 'meta').length,
        rawInboxCount: rawFiles.filter(f => f.folder === 'inbox').length,
        rawLifeOsCount: rawFiles.filter(f => f.folder === 'life-os').length,
        brokenLinkCount,
        orphanCount,
        lastUpdated: dates[dates.length - 1] ?? null,
      },
      recentLogs,
      graph,
    };
  }

  getPage(relPath: string): WikiPageDetail {
    const abs = resolveSafeWikiPath(this.rootDir, relPath, 'read');
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new DomainError('위키 문서를 찾을 수 없습니다.', 404);
    }

    const normalized = relPath.replace(/^\/+/, '');
    const { parsedPages } = this.collectPages();
    const summaryPool = parsedPages.map(p => p.summary);

    const existing = parsedPages.find(p => p.summary.path === normalized);
    if (existing) {
      const outgoingLinks = existing.rawLinks.map(l => ({
        target: l.target,
        label: l.label,
        resolvedPath: resolveWikiLink(l.target, summaryPool),
      }));
      const backlinks = parsedPages
        .filter(
          other =>
            other.summary.path !== normalized &&
            other.rawLinks.some(l => resolveWikiLink(l.target, summaryPool) === normalized),
        )
        .map(other => ({
          path: other.summary.path,
          title: other.summary.title,
          category: other.summary.category,
        }));

      return {
        ...existing.summary,
        rawMarkdown: existing.rawMarkdown,
        body: existing.body,
        outgoingLinks,
        backlinks,
      };
    }

    // Raw preview (e.g., raw/inbox/*.md or raw/life-os/*.md)
    const ext = path.extname(normalized).toLowerCase();
    if (!PREVIEWABLE_RAW_EXTENSIONS.has(ext)) {
      throw new DomainError('텍스트 형식의 파일만 미리볼 수 있습니다.', 400);
    }
    const rawContent = fs.readFileSync(abs, 'utf8');
    const stat = fs.statSync(abs);
    const { data, body } = parseFrontmatter(rawContent);
    const rawLinks = extractWikiLinks(body);
    return {
      path: normalized,
      slug: path.basename(normalized),
      title: asString(data.title) ?? stripMarkdownTitleHeading(body) ?? path.basename(normalized),
      category: 'meta',
      tags: asStringArray(data.tags),
      updated: asString(data.updated) ?? stat.mtime.toISOString().slice(0, 10),
      summary: '불변 원본(Raw) 파일 미리보기',
      sources: [],
      outgoingCount: 0,
      backlinkCount: 0,
      wordCount: countWords(body),
      isRaw: true,
      rawMarkdown: rawContent,
      body: ext === '.md' ? body : `\`\`\`${ext.slice(1)}\n${rawContent}\n\`\`\``,
      outgoingLinks: rawLinks.map(l => ({
        target: l.target,
        label: l.label,
        resolvedPath: resolveWikiLink(l.target, summaryPool),
      })),
      backlinks: [],
    };
  }

  captureRawNote(input: {
    title: string;
    content: string;
    sourceUrl?: string;
    tags?: string[];
  }): WikiRawFile {
    const title = (input.title ?? '').trim();
    const content = (input.content ?? '').trim();
    const sourceUrl = (input.sourceUrl ?? '').trim();
    const tags = (input.tags ?? []).map(t => t.trim()).filter(Boolean).slice(0, 12);

    if (!title || title.length > 160) {
      throw new DomainError('제목은 1~160자여야 합니다.', 400);
    }
    if (!content || content.length > 100_000) {
      throw new DomainError('내용은 1~100,000자여야 합니다.', 400);
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      throw new DomainError('출처 URL은 http:// 또는 https://만 허용됩니다.', 400);
    }

    const inboxDir = path.join(this.rootDir, 'raw', 'inbox');
    fs.mkdirSync(inboxDir, { recursive: true });

    const stamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const slug = sanitizeRawSlug(title);
    let fileName = `${stamp}-${slug}.md`;
    let relPath = `raw/inbox/${fileName}`;
    let absPath = resolveSafeWikiPath(this.rootDir, relPath, 'raw-write');
    let counter = 1;
    while (fs.existsSync(absPath)) {
      fileName = `${stamp}-${slug}-${counter++}.md`;
      relPath = `raw/inbox/${fileName}`;
      absPath = resolveSafeWikiPath(this.rootDir, relPath, 'raw-write');
    }

    const escTitle = title.replace(/"/g, '\\"');
    const frontmatterLines = [
      '---',
      `title: "${escTitle}"`,
      `capturedAt: ${new Date().toISOString()}`,
      sourceUrl ? `sourceUrl: ${sourceUrl}` : null,
      tags.length ? `tags: [${tags.map(t => `"${t.replace(/"/g, '')}"`).join(', ')}]` : null,
      '---',
    ].filter(Boolean);

    const md = `${frontmatterLines.join('\n')}\n\n# ${title}\n\n${content}\n`;
    fs.writeFileSync(absPath, md, 'utf8');
    const stat = fs.statSync(absPath);

    return {
      path: relPath,
      name: fileName,
      folder: 'inbox',
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      previewable: true,
    };
  }

  uploadRawFile(input: { fileName: string; buffer: Buffer }): WikiRawFile {
    const origName = (input.fileName ?? '').trim();
    if (!origName) {
      throw new DomainError('파일 이름이 필요합니다.', 400);
    }
    if (!input.buffer || input.buffer.length === 0) {
      throw new DomainError('빈 파일은 업로드할 수 없습니다.', 400);
    }
    if (input.buffer.length > MAX_RAW_UPLOAD_BYTES) {
      throw new DomainError('파일 크기는 10MB 이하여야 합니다.', 400);
    }

    const ext = path.extname(origName).toLowerCase();
    if (!ALLOWED_RAW_EXTENSIONS.has(ext)) {
      throw new DomainError(
        '허용되지 않는 파일 형식입니다 (.md, .txt, .pdf, .csv, .xlsx, .json, 이미지).',
        400,
      );
    }

    const inboxDir = path.join(this.rootDir, 'raw', 'inbox');
    fs.mkdirSync(inboxDir, { recursive: true });

    const baseName = path.basename(origName, path.extname(origName));
    const safeSlug = sanitizeRawSlug(baseName);
    const stamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    let fileName = `${stamp}-${safeSlug}${ext}`;
    let relPath = `raw/inbox/${fileName}`;
    let absPath = resolveSafeWikiPath(this.rootDir, relPath, 'raw-write');
    let counter = 1;
    while (fs.existsSync(absPath)) {
      fileName = `${stamp}-${safeSlug}-${counter++}${ext}`;
      relPath = `raw/inbox/${fileName}`;
      absPath = resolveSafeWikiPath(this.rootDir, relPath, 'raw-write');
    }

    fs.writeFileSync(absPath, input.buffer);
    const stat = fs.statSync(absPath);

    return {
      path: relPath,
      name: fileName,
      folder: 'inbox',
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      previewable: PREVIEWABLE_RAW_EXTENSIONS.has(ext),
    };
  }

  search(query: string, limit = SEARCH_PAGE_SIZE): SearchResult[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const { parsedPages } = this.collectPages();
    const hits: { page: ParsedDiskPage; score: number; snippet: string }[] = [];

    for (const page of parsedPages) {
      const titleLower = page.summary.title.toLowerCase();
      const summaryLower = page.summary.summary.toLowerCase();
      const tagsLower = page.summary.tags.join(' ').toLowerCase();
      const bodyLower = page.body.toLowerCase();

      let score = 0;
      if (titleLower.includes(q)) score += 3;
      if (tagsLower.includes(q) || summaryLower.includes(q)) score += 2;
      const bodyIdx = bodyLower.indexOf(q);
      if (bodyIdx >= 0) score += 1;
      if (score === 0) continue;

      const sourceText =
        bodyIdx >= 0 ? page.body : page.summary.summary || page.summary.title;
      const idx = bodyIdx >= 0 ? bodyIdx : 0;
      const start = Math.max(0, idx - 40);
      const snippet = `${start ? '…' : ''}${sourceText.slice(start, start + 180)}${
        sourceText.length > start + 180 ? '…' : ''
      }`;

      hits.push({ page, score, snippet });
    }

    hits.sort(
      (a, b) =>
        b.score - a.score ||
        (b.page.summary.updated ?? '').localeCompare(a.page.summary.updated ?? '') ||
        a.page.summary.path.localeCompare(b.page.summary.path),
    );

    return hits.slice(0, limit).map(({ page, snippet }) => ({
      kind: 'wiki',
      id: `wiki:${page.summary.path}`,
      title: page.summary.title,
      excerpt: snippet,
      period: page.summary.updated ?? WIKI_CATEGORY_LABEL[page.summary.category],
      href: `/wiki?page=${encodeURIComponent(page.summary.path)}`,
    }));
  }
}

export type WikiCategory = 'life' | 'topics' | 'sources' | 'synthesis' | 'meta';
export type WikiGraphNodeCategory = WikiCategory | 'unresolved';

export const WIKI_CATEGORY_LABEL: Record<WikiCategory, string> = {
  life: '삶 · 원칙',
  topics: '주제 · 개념',
  sources: '출처 요약',
  synthesis: '통찰 · 합성',
  meta: '인덱스 · 규칙',
};

export interface WikiGraphNode {
  id: string;
  label: string;
  category: WikiGraphNodeCategory;
  summary: string;
  tags: string[];
  degree: number;
  backlinkCount: number;
  outgoingCount: number;
  isOrphan: boolean;
  unresolved?: boolean;
}

export interface WikiGraphEdge {
  source: string;
  target: string;
  resolved: boolean;
}

export interface WikiGraphData {
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
}

export interface WikiLinkRef {
  target: string;
  label: string;
  resolvedPath: string | null;
}

export interface WikiPageSummary {
  path: string;
  slug: string;
  title: string;
  category: WikiCategory;
  tags: string[];
  updated: string | null;
  summary: string;
  sources: string[];
  outgoingCount: number;
  backlinkCount: number;
  wordCount: number;
  isRaw?: boolean;
}

export interface WikiPageDetail extends WikiPageSummary {
  rawMarkdown: string;
  body: string;
  outgoingLinks: WikiLinkRef[];
  backlinks: { path: string; title: string; category: WikiCategory }[];
}

export interface WikiRawFile {
  path: string;
  name: string;
  folder: 'inbox' | 'life-os';
  sizeBytes: number;
  updatedAt: string;
  previewable: boolean;
}

export interface WikiLogEntry {
  heading: string;
  date: string | null;
  kind: string | null;
  summary: string;
}

export interface WikiStats {
  totalPages: number;
  rawInboxCount: number;
  rawLifeOsCount: number;
  brokenLinkCount: number;
  orphanCount: number;
  lastUpdated: string | null;
}

export interface WikiIndexResponse {
  initialized: boolean;
  pages: WikiPageSummary[];
  rawFiles: WikiRawFile[];
  stats: WikiStats;
  recentLogs: WikiLogEntry[];
  graph: WikiGraphData;
}

function unquoteYaml(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFrontmatter(raw: string): {
  data: Record<string, string | string[]>;
  body: string;
} {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: {}, body: normalized };
  }
  const endIdx = normalized.indexOf('\n---\n', 4);
  const altEnd = endIdx === -1 && normalized.endsWith('\n---') ? normalized.length - 4 : endIdx;
  if (altEnd === -1) {
    return { data: {}, body: normalized };
  }

  const yamlBlock = normalized.slice(4, altEnd);
  const body = normalized.slice(altEnd + 4).replace(/^\n+/, '');
  const data: Record<string, string | string[]> = {};
  const lines = yamlBlock.split('\n');

  let currentArrayKey: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (currentArrayKey && trimmed.startsWith('- ')) {
      const existing = Array.isArray(data[currentArrayKey]) ? (data[currentArrayKey] as string[]) : [];
      existing.push(unquoteYaml(trimmed.slice(2)));
      data[currentArrayKey] = existing;
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx <= 0) {
      currentArrayKey = null;
      continue;
    }
    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();

    if (!rest) {
      currentArrayKey = key;
      data[key] = [];
      continue;
    }

    currentArrayKey = null;
    if (rest.startsWith('[') && rest.endsWith(']')) {
      const items = rest
        .slice(1, -1)
        .split(',')
        .map(item => unquoteYaml(item))
        .filter(Boolean);
      data[key] = items;
    } else {
      data[key] = unquoteYaml(rest);
    }
  }

  return { data, body };
}

export function stripMarkdownTitleHeading(body: string): string | null {
  for (const line of body.split(/\r?\n/)) {
    const m = /^#\s+(.+)$/.exec(line.trim());
    if (m) return m[1].trim();
  }
  return null;
}

export function extractWikiLinks(markdown: string): { target: string; label: string }[] {
  const withoutCode = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '');
  const results: { target: string; label: string }[] = [];
  const seen = new Set<string>();
  const re = /\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]+?))?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutCode)) !== null) {
    const rawTarget = match[1].trim();
    const label = (match[2] ?? rawTarget).trim();
    if (!rawTarget) continue;
    const key = `${rawTarget}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ target: rawTarget, label });
  }
  return results;
}

function normalizeTargetKey(input: string): string {
  return input
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/#.*$/, '')
    .toLowerCase();
}

export function resolveWikiLink(
  target: string,
  pages: Pick<WikiPageSummary, 'path' | 'slug' | 'title'>[],
): string | null {
  const normalized = normalizeTargetKey(target);
  if (!normalized) return null;

  for (const p of pages) {
    const noExt = p.path.replace(/\.md$/i, '').toLowerCase();
    if (p.path.toLowerCase() === normalized || noExt === normalized) return p.path;
  }
  for (const p of pages) {
    if (p.slug.toLowerCase() === normalized) return p.path;
  }
  for (const p of pages) {
    if (p.title.trim().toLowerCase() === normalized) return p.path;
  }
  return null;
}

export function sanitizeRawSlug(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'note';
}

'use client';

import type { ReactNode } from 'react';
import type { WikiLinkRef } from '@/lib/wiki';

interface Props {
  markdown: string;
  outgoingLinks: WikiLinkRef[];
  onNavigateWiki: (targetPath: string) => void;
}

function renderInline(
  text: string,
  linkMap: Map<string, string | null>,
  onNavigateWiki: (targetPath: string) => void,
  keyPrefix: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRe =
    /(\[\[[^[\]\n]+?\]\]|`[^`\n]+`|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|\[[^[\]\n]+?\]\([^()\n]+?\))/g;
  let lastIndex = 0;
  let idx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('[[')) {
      const inner = token.slice(2, -2);
      const barIdx = inner.indexOf('|');
      const rawTarget = (barIdx >= 0 ? inner.slice(0, barIdx) : inner).trim();
      const label = (barIdx >= 0 ? inner.slice(barIdx + 1) : inner).trim();
      const resolvedPath = linkMap.get(rawTarget) ?? null;

      if (resolvedPath) {
        nodes.push(
          <button
            key={key}
            type="button"
            onClick={() => onNavigateWiki(resolvedPath)}
            className="mx-0.5 inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[0.9em] font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
          >
            {label}
          </button>,
        );
      } else {
        nodes.push(
          <span
            key={key}
            title={`아직 작성되지 않은 위키 문서: ${rawTarget}`}
            className="mx-0.5 inline-flex items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[0.9em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
          >
            {label}
          </span>,
        );
      }
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {renderInline(token.slice(2, -2), linkMap, onNavigateWiki, `${key}-b`)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), linkMap, onNavigateWiki, `${key}-i`)}
        </em>,
      );
    } else if (token.startsWith('[')) {
      const m = /^\[([^[\]]+)\]\(([^()]+)\)$/.exec(token);
      if (m) {
        const href = m[2].trim();
        if (/^https?:\/\//i.test(href)) {
          nodes.push(
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {m[1]}
            </a>,
          );
        } else {
          nodes.push(m[1]);
        }
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function WikiMarkdown({ markdown, outgoingLinks, onNavigateWiki }: Props) {
  const linkMap = new Map<string, string | null>();
  for (const link of outgoingLinks) {
    linkMap.set(link.target, link.resolvedPath);
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`pre-${i}`}
          className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 font-mono text-xs leading-6 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
        >
          {lang && (
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {lang}
            </div>
          )}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="border-zinc-200 dark:border-zinc-800" />);
      i++;
      continue;
    }

    // Headings
    const hMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (hMatch) {
      const level = hMatch[1].length;
      const content = renderInline(hMatch[2], linkMap, onNavigateWiki, `h-${i}`);
      if (level === 1) {
        blocks.push(
          <h1
            key={`h-${i}`}
            className="mt-2 font-serif text-xl font-bold text-zinc-900 dark:text-zinc-50"
          >
            {content}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            key={`h-${i}`}
            className="mt-5 border-b border-zinc-100 pb-1.5 font-serif text-lg font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
          >
            {content}
          </h2>,
        );
      } else if (level === 3) {
        blocks.push(
          <h3 key={`h-${i}`} className="mt-4 text-base font-semibold text-zinc-800 dark:text-zinc-100">
            {content}
          </h3>,
        );
      } else {
        blocks.push(
          <h4 key={`h-${i}`} className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {content}
          </h4>,
        );
      }
      i++;
      continue;
    }

    // Blockquote / alert
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const joined = quoteLines.join(' ').trim();
      const isWarning = joined.startsWith('[!warning]') || joined.startsWith('[!caution]');
      const cleanQuote = joined.replace(/^\[!(warning|caution|note|tip|important)\]\s*/i, '');
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className={`rounded-r-xl border-l-4 px-4 py-2.5 text-sm leading-6 ${
            isWarning
              ? 'border-amber-500 bg-amber-50/70 text-amber-950 dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-100'
              : 'border-blue-400 bg-zinc-50 text-zinc-700 dark:border-blue-600 dark:bg-zinc-900/80 dark:text-zinc-300'
          }`}
        >
          {renderInline(cleanQuote, linkMap, onNavigateWiki, `bq-${i}`)}
        </blockquote>,
      );
      continue;
    }

    // Table
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|?[\s:|-]+\|/.test(lines[i + 1].trim())) {
      const parseRow = (rowLine: string) =>
        rowLine
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map(cell => cell.trim());
      const headers = parseRow(lines[i]);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="border-b border-zinc-200 px-3 py-2 font-semibold dark:border-zinc-800">
                    {renderInline(h, linkMap, onNavigateWiki, `th-${i}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      {renderInline(r[ci] ?? '', linkMap, onNavigateWiki, `td-${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {items.map((item, idx) => (
            <li key={idx} className="break-words">
              {renderInline(item, linkMap, onNavigateWiki, `ul-${i}-${idx}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {items.map((item, idx) => (
            <li key={idx} className="break-words">
              {renderInline(item, linkMap, onNavigateWiki, `ol-${i}-${idx}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} className="break-words text-sm leading-7 text-zinc-700 dark:text-zinc-300">
        {renderInline(paraLines.join(' '), linkMap, onNavigateWiki, `p-${i}`)}
      </p>,
    );
  }

  return <div className="space-y-3.5">{blocks}</div>;
}

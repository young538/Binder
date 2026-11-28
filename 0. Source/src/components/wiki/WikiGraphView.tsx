'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Expand,
  ExternalLink,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  WIKI_CATEGORY_LABEL,
  type WikiGraphData,
  type WikiGraphNode,
  type WikiGraphNodeCategory,
} from '@/lib/wiki';
import {
  filterWikiGraph,
  layoutWikiGraph,
  nodeRadius,
} from '@/lib/wikiGraph';

interface Props {
  mode: 'global' | 'local';
  graph: WikiGraphData;
  activePath?: string | null;
  searchHighlight?: string;
  onOpenPage: (path: string) => void;
  onExpandToGlobal?: () => void;
}

const NODE_CATEGORY_ORDER: WikiGraphNodeCategory[] = [
  'life',
  'topics',
  'sources',
  'synthesis',
];

const NODE_FILL_CLASS: Record<WikiGraphNodeCategory, string> = {
  life: 'fill-[#c15f3c] dark:fill-[#df8b68]',
  topics: 'fill-[#3d7a5e] dark:fill-[#6ab392]',
  sources: 'fill-[#c07a28] dark:fill-[#e3a657]',
  synthesis: 'fill-[#8f4763] dark:fill-[#d48ba8]',
  meta: 'fill-[#8a8478] dark:fill-[#9c978b]',
  unresolved: 'fill-zinc-50 stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-500',
};

const NODE_DOT_CLASS: Record<WikiGraphNodeCategory, string> = {
  life: 'bg-[#c15f3c] dark:bg-[#df8b68]',
  topics: 'bg-[#3d7a5e] dark:bg-[#6ab392]',
  sources: 'bg-[#c07a28] dark:bg-[#e3a657]',
  synthesis: 'bg-[#8f4763] dark:bg-[#d48ba8]',
  meta: 'bg-[#8a8478] dark:bg-[#9c978b]',
  unresolved: 'border border-dashed border-zinc-400 bg-transparent',
};

const CATEGORY_TEXT: Record<WikiGraphNodeCategory, string> = {
  life: WIKI_CATEGORY_LABEL.life,
  topics: WIKI_CATEGORY_LABEL.topics,
  sources: WIKI_CATEGORY_LABEL.sources,
  synthesis: WIKI_CATEGORY_LABEL.synthesis,
  meta: WIKI_CATEGORY_LABEL.meta,
  unresolved: '미작성 링크',
};

export function WikiGraphView({
  mode,
  graph,
  activePath = null,
  searchHighlight = '',
  onOpenPage,
  onExpandToGlobal,
}: Props) {
  const isLocal = mode === 'local';
  const width = isLocal ? 480 : 780;
  const height = isLocal ? 250 : 500;

  const [hideMeta, setHideMeta] = useState(true);
  const [showUnresolved, setShowUnresolved] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<Set<WikiGraphNodeCategory>>(
    () => new Set(),
  );
  const [localDepth, setLocalDepth] = useState<1 | 2>(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pickedNodeId, setPickedNodeId] = useState<string | null>(null);
  const [dragOverrides, setDragOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  const svgRef = useRef<SVGSVGElement>(null);
  const suppressClickRef = useRef(false);
  const dragSession = useRef<
    | {
        kind: 'node';
        nodeId: string;
        startClientX: number;
        startClientY: number;
        origX: number;
        origY: number;
        moved: boolean;
      }
    | {
        kind: 'pan';
        startClientX: number;
        startClientY: number;
        origX: number;
        origY: number;
        moved: boolean;
      }
    | null
  >(null);

  const filtered = useMemo(
    () =>
      filterWikiGraph(graph, {
        hideMeta,
        showUnresolved,
        hiddenCategories,
        centerId: isLocal ? activePath : null,
        depth: localDepth,
      }),
    [activePath, graph, hiddenCategories, hideMeta, isLocal, localDepth, showUnresolved],
  );

  const basePositions = useMemo(
    () =>
      layoutWikiGraph(filtered.nodes, filtered.edges, {
        width,
        height,
        centerId: isLocal ? activePath : null,
        iterations: isLocal ? 120 : 170,
      }),
    [activePath, filtered.edges, filtered.nodes, height, isLocal, width],
  );

  const positions = useMemo(() => {
    const merged: Record<string, { x: number; y: number }> = { ...basePositions };
    for (const [id, pt] of Object.entries(dragOverrides)) {
      if (merged[id]) merged[id] = pt;
    }
    return merged;
  }, [basePositions, dragOverrides]);

  const selectedNode = useMemo<WikiGraphNode | null>(() => {
    const candidateId = pickedNodeId ?? activePath;
    if (!candidateId) return null;
    return filtered.nodes.find(n => n.id === candidateId) ?? null;
  }, [activePath, filtered.nodes, pickedNodeId]);

  const highlightedIds = useMemo(() => {
    if (!hoveredId) return null;
    const set = new Set<string>([hoveredId]);
    for (const e of filtered.edges) {
      if (e.source === hoveredId) set.add(e.target);
      if (e.target === hoveredId) set.add(e.source);
    }
    return set;
  }, [filtered.edges, hoveredId]);

  const searchQ = searchHighlight.trim().toLowerCase();

  const clientToSvgDelta = (dx: number, dy: number) => {
    const svg = svgRef.current;
    if (!svg) return { dx, dy };
    const rect = svg.getBoundingClientRect();
    const scaleX = width / Math.max(1, rect.width);
    const scaleY = height / Math.max(1, rect.height);
    return {
      dx: (dx * scaleX) / transform.scale,
      dy: (dy * scaleY) / transform.scale,
    };
  };

  const toggleCategory = (cat: WikiGraphNodeCategory) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setDragOverrides({});
  };

  const adjustZoom = (factor: number) => {
    setTransform(prev => {
      const nextScale = Math.max(0.4, Math.min(2.8, prev.scale * factor));
      return { ...prev, scale: Math.round(nextScale * 100) / 100 };
    });
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    suppressClickRef.current = false;
    dragSession.current = {
      kind: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: transform.x,
      origY: transform.y,
      moved: false,
    };
  };

  const handleNodePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    node: WikiGraphNode,
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const pos = positions[node.id];
    if (!pos) return;
    suppressClickRef.current = false;
    dragSession.current = {
      kind: 'node',
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const sess = dragSession.current;
    if (!sess) return;
    const rawDx = e.clientX - sess.startClientX;
    const rawDy = e.clientY - sess.startClientY;
    if (!sess.moved) {
      if (Math.hypot(rawDx, rawDy) < 5) return;
      sess.moved = true;
      suppressClickRef.current = true;
      svgRef.current?.setPointerCapture?.(e.pointerId);
    }

    if (sess.kind === 'node') {
      const { dx, dy } = clientToSvgDelta(rawDx, rawDy);
      const nextX = Math.max(24, Math.min(width - 24, sess.origX + dx));
      const nextY = Math.max(24, Math.min(height - 24, sess.origY + dy));
      setDragOverrides(prev => ({
        ...prev,
        [sess.nodeId]: { x: nextX, y: nextY },
      }));
    } else {
      const svg = svgRef.current;
      const rect = svg?.getBoundingClientRect();
      const sx = rect ? width / Math.max(1, rect.width) : 1;
      const sy = rect ? height / Math.max(1, rect.height) : 1;
      setTransform(prev => ({
        ...prev,
        x: sess.origX + rawDx * sx,
        y: sess.origY + rawDy * sy,
      }));
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture?.(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    dragSession.current = null;
  };

  const handleNodeClick = (node: WikiGraphNode) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setPickedNodeId(node.id);
    if (isLocal && !node.unresolved && node.id !== activePath) {
      onOpenPage(node.id);
    }
  };

  const handleNodeDoubleClick = (node: WikiGraphNode) => {
    if (!node.unresolved) {
      onOpenPage(node.id);
    }
  };

  return (
    <div className="space-y-3">
      {isLocal ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              이웃 연결 ({filtered.nodes.length}노드 · {filtered.edges.length}링크)
            </span>
            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-950">
              {([1, 2] as const).map(depth => (
                <button
                  key={depth}
                  type="button"
                  aria-pressed={localDepth === depth}
                  onClick={() => setLocalDepth(depth)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                    localDepth === depth
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {depth}촌
                </button>
              ))}
            </div>
          </div>
          {onExpandToGlobal && (
            <button
              type="button"
              onClick={onExpandToGlobal}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Expand size={12} />
              전체 그래프
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-1.5">
            {NODE_CATEGORY_ORDER.map(cat => {
              const hidden = hiddenCategories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={!hidden}
                  onClick={() => toggleCategory(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    hidden
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-400 line-through dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${NODE_DOT_CLASS[cat]}`} aria-hidden="true" />
                  {CATEGORY_TEXT[cat]}
                </button>
              );
            })}

            <button
              type="button"
              aria-pressed={hideMeta}
              onClick={() => setHideMeta(prev => !prev)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                hideMeta
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }`}
            >
              index.md 숨기기
            </button>

            <button
              type="button"
              aria-pressed={showUnresolved}
              onClick={() => setShowUnresolved(prev => !prev)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                showUnresolved
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }`}
            >
              미작성 링크
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="mr-1.5 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {filtered.nodes.length}노드 · {filtered.edges.length}연결
            </span>
            <button
              type="button"
              aria-label="그래프 축소"
              onClick={() => adjustZoom(0.8)}
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Minus size={13} />
            </button>
            <button
              type="button"
              aria-label="그래프 확대"
              onClick={() => adjustZoom(1.25)}
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              aria-label="화면 맞춤"
              title="위치·줌 초기화"
              onClick={resetView}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {isLocal ? <Maximize2 size={12} /> : <RotateCcw size={12} />}
              맞춤
            </button>
          </div>
        </div>
      )}

      <div
        className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/80 ${
          isLocal ? '' : 'shadow-sm'
        }`}
      >
        {filtered.nodes.length === 0 ? (
          <div className="flex h-52 items-center justify-center p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            표시할 위키 노드가 없습니다. 상단 필터를 조정해 보세요.
          </div>
        ) : (
          <svg
            ref={svgRef}
            role="img"
            aria-label={isLocal ? '현재 문서 로컬 그래프' : '위키 연결 그래프'}
            viewBox={`0 0 ${width} ${height}`}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
            onWheel={e => {
              if (isLocal) return;
              e.preventDefault();
              adjustZoom(e.deltaY < 0 ? 1.1 : 0.9);
            }}
            className={`w-full select-none touch-none ${
              isLocal ? 'h-[220px] sm:h-[250px]' : 'h-[400px] sm:h-[520px]'
            } cursor-grab active:cursor-grabbing`}
          >
            <g
              transform={`translate(${width / 2 + transform.x}, ${height / 2 + transform.y}) scale(${transform.scale}) translate(${-width / 2}, ${-height / 2})`}
            >
              {/* Edges */}
              {filtered.edges.map(edge => {
                const p1 = positions[edge.source];
                const p2 = positions[edge.target];
                if (!p1 || !p2) return null;
                const activeEdge =
                  !hoveredId || edge.source === hoveredId || edge.target === hoveredId;
                return (
                  <line
                    key={`${edge.source}->${edge.target}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    strokeWidth={hoveredId && activeEdge ? 1.8 : 1.1}
                    strokeDasharray={edge.resolved ? undefined : '4 3'}
                    className={`transition-opacity duration-150 ${
                      hoveredId && activeEdge
                        ? 'stroke-blue-500 dark:stroke-blue-400'
                        : 'stroke-zinc-300 dark:stroke-zinc-700'
                    }`}
                    opacity={activeEdge ? (hoveredId ? 0.95 : 0.7) : 0.14}
                  />
                );
              })}

              {/* Nodes */}
              {filtered.nodes.map(node => {
                const pos = positions[node.id];
                if (!pos) return null;
                const isCenter = Boolean(activePath && node.id === activePath);
                const isSelected = Boolean(selectedNode && selectedNode.id === node.id);
                const isMatch =
                  searchQ.length > 0 &&
                  (node.label.toLowerCase().includes(searchQ) ||
                    node.tags.some(t => t.toLowerCase().includes(searchQ)));
                const isNeighbor = !highlightedIds || highlightedIds.has(node.id);
                const r = nodeRadius(node.degree, isCenter);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.label} (${CATEGORY_TEXT[node.category]}, 연결 ${node.degree})`}
                    onPointerDown={e => handleNodePointerDown(e, node)}
                    onPointerEnter={() => setHoveredId(node.id)}
                    onPointerLeave={() => setHoveredId(cur => (cur === node.id ? null : cur))}
                    onClick={() => handleNodeClick(node)}
                    onDoubleClick={() => handleNodeDoubleClick(node)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!node.unresolved) onOpenPage(node.id);
                        else setPickedNodeId(node.id);
                      }
                    }}
                    opacity={isNeighbor ? 1 : 0.2}
                    className="cursor-pointer transition-opacity duration-150 focus:outline-none"
                  >
                    {(isCenter || isSelected || isMatch) && (
                      <circle
                        r={r + 5}
                        fill="none"
                        strokeWidth={isMatch ? 2.2 : 1.8}
                        className={
                          isMatch
                            ? 'stroke-amber-500 dark:stroke-amber-400'
                            : 'stroke-blue-500 dark:stroke-blue-400'
                        }
                      />
                    )}
                    <circle
                      r={r}
                      strokeWidth={node.unresolved ? 1.5 : 1.5}
                      strokeDasharray={node.unresolved ? '3 2' : undefined}
                      className={`${NODE_FILL_CLASS[node.category]} ${
                        node.unresolved ? '' : 'stroke-white dark:stroke-zinc-950'
                      }`}
                    />
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      className={`pointer-events-none select-none font-sans ${
                        isCenter || isSelected || hoveredId === node.id
                          ? 'fill-zinc-900 font-semibold dark:fill-zinc-50'
                          : 'fill-zinc-600 dark:fill-zinc-400'
                      }`}
                      style={{ fontSize: isLocal ? '10.5px' : '11px' }}
                    >
                      {node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {!isLocal && selectedNode && (
        <div
          aria-label="선택한 그래프 노드 정보"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <span className={`h-2 w-2 rounded-full ${NODE_DOT_CLASS[selectedNode.category]}`} />
                {CATEGORY_TEXT[selectedNode.category]}
              </span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                연결 {selectedNode.degree}개 · 역링크 {selectedNode.backlinkCount} · 발신 {selectedNode.outgoingCount}
              </span>
            </div>
            <div className="font-serif text-base font-bold text-zinc-900 dark:text-zinc-50">
              {selectedNode.label}
            </div>
            {selectedNode.summary && (
              <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                {selectedNode.summary}
              </p>
            )}
          </div>
          {!selectedNode.unresolved && (
            <button
              type="button"
              onClick={() => onOpenPage(selectedNode.id)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <ExternalLink size={13} />
              문서 열기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

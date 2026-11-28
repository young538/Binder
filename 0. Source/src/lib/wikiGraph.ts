import type {
  WikiGraphData,
  WikiGraphEdge,
  WikiGraphNode,
  WikiGraphNodeCategory,
} from './wiki';

const SECTOR_ANGLE: Record<WikiGraphNodeCategory, number> = {
  life: -Math.PI * 0.75,
  topics: -Math.PI * 0.25,
  sources: Math.PI * 0.25,
  synthesis: Math.PI * 0.75,
  meta: -Math.PI * 0.5,
  unresolved: Math.PI * 0.5,
};

export function computeNeighborhood(
  centerId: string,
  edges: WikiGraphEdge[],
  depth: 1 | 2,
): Set<string> {
  const visited = new Set<string>([centerId]);
  let frontier = new Set<string>([centerId]);

  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.source) && !visited.has(edge.target)) {
        visited.add(edge.target);
        next.add(edge.target);
      } else if (frontier.has(edge.target) && !visited.has(edge.source)) {
        visited.add(edge.source);
        next.add(edge.source);
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
}

export function filterWikiGraph(
  graph: WikiGraphData,
  options: {
    hideMeta: boolean;
    showUnresolved: boolean;
    hiddenCategories?: ReadonlySet<WikiGraphNodeCategory>;
    centerId?: string | null;
    depth?: 1 | 2;
  },
): WikiGraphData {
  const centerId = options.centerId ?? null;
  const hidden = options.hiddenCategories;

  let nodes = graph.nodes.filter(node => {
    if (centerId && node.id === centerId) return true;
    if (options.hideMeta && node.category === 'meta') return false;
    if (!options.showUnresolved && node.category === 'unresolved') return false;
    if (hidden?.has(node.category)) return false;
    return true;
  });

  const allowedIds = new Set(nodes.map(n => n.id));
  let edges = graph.edges.filter(
    edge =>
      allowedIds.has(edge.source) &&
      allowedIds.has(edge.target) &&
      (options.showUnresolved || edge.resolved),
  );

  if (centerId && allowedIds.has(centerId)) {
    const neighborhood = computeNeighborhood(centerId, edges, options.depth ?? 1);
    nodes = nodes.filter(node => neighborhood.has(node.id));
    const localIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(
      edge => localIds.has(edge.source) && localIds.has(edge.target),
    );
  }

  const degMap = new Map<string, number>();
  for (const edge of edges) {
    degMap.set(edge.source, (degMap.get(edge.source) ?? 0) + 1);
    degMap.set(edge.target, (degMap.get(edge.target) ?? 0) + 1);
  }

  return {
    nodes: nodes.map(node => ({ ...node, degree: degMap.get(node.id) ?? 0 })),
    edges,
  };
}

export function nodeRadius(degree: number, isCenter = false): number {
  return isCenter ? 15 : Math.min(18, 7 + Math.sqrt(Math.max(0, degree)) * 2.5);
}

export function layoutWikiGraph(
  nodes: WikiGraphNode[],
  edges: WikiGraphEdge[],
  options?: {
    width?: number;
    height?: number;
    centerId?: string | null;
    iterations?: number;
  },
): Record<string, { x: number; y: number }> {
  const width = options?.width ?? 760;
  const height = options?.height ?? 500;
  const centerId = options?.centerId ?? null;
  const iterations = options?.iterations ?? 160;
  const cx = width / 2;
  const cy = height / 2;
  const padX = Math.min(64, width * 0.1);
  const padY = Math.min(48, height * 0.12);

  if (nodes.length === 0) return {};
  if (nodes.length === 1) {
    return { [nodes[0].id]: { x: cx, y: cy } };
  }

  const ordered = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const indexById = new Map<string, number>();
  ordered.forEach((n, idx) => indexById.set(n.id, idx));

  const catTotals = new Map<WikiGraphNodeCategory, number>();
  const catSeen = new Map<WikiGraphNodeCategory, number>();
  for (const n of ordered) {
    catTotals.set(n.category, (catTotals.get(n.category) ?? 0) + 1);
  }

  const baseRadius = Math.min(width, height) * (centerId ? 0.32 : 0.28);
  const pos = ordered.map((n, i) => {
    if (centerId && n.id === centerId) {
      return { x: cx, y: cy };
    }
    const idxInCat = catSeen.get(n.category) ?? 0;
    catSeen.set(n.category, idxInCat + 1);
    const totalInCat = catTotals.get(n.category) ?? 1;
    const baseAngle = SECTOR_ANGLE[n.category] ?? 0;
    const spread = Math.PI * 0.65;
    const offset =
      totalInCat === 1 ? 0 : ((idxInCat / (totalInCat - 1)) - 0.5) * spread;
    const angle = baseAngle + offset;
    const ringFactor = 0.72 + ((i % 3) * 0.16);
    return {
      x: cx + Math.cos(angle) * baseRadius * ringFactor,
      y: cy + Math.sin(angle) * baseRadius * ringFactor,
    };
  });

  const edgePairs: [number, number][] = [];
  for (const e of edges) {
    const si = indexById.get(e.source);
    const ti = indexById.get(e.target);
    if (si !== undefined && ti !== undefined && si !== ti) {
      edgePairs.push([si, ti]);
    }
  }

  const area = width * height;
  const k = Math.sqrt(area / ordered.length) * (centerId ? 0.62 : 0.78);
  let temp = Math.min(width, height) * 0.14;
  const cooling = temp / Math.max(1, iterations);

  for (let iter = 0; iter < iterations; iter++) {
    const dispX = new Float64Array(ordered.length);
    const dispY = new Float64Array(ordered.length);

    // Repulsive forces
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          dx = ((i + 1) % 3) - 1 || 0.7;
          dy = ((j + 1) % 3) - 1 || -0.7;
          distSq = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(distSq);
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        dispX[i] += fx;
        dispY[i] += fy;
        dispX[j] -= fx;
        dispY[j] -= fy;
      }
    }

    // Attractive edge spring forces
    for (const [si, ti] of edgePairs) {
      const dx = pos[si].x - pos[ti].x;
      const dy = pos[si].y - pos[ti].y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist * dist) / (k * 1.15);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      dispX[si] -= fx;
      dispY[si] -= fy;
      dispX[ti] += fx;
      dispY[ti] += fy;
    }

    // Gentle center gravity (stronger for orphans so they cluster cleanly)
    for (let i = 0; i < ordered.length; i++) {
      const pull = ordered[i].isOrphan ? 0.09 : 0.045;
      dispX[i] += (cx - pos[i].x) * pull;
      dispY[i] += (cy - pos[i].y) * pull;
    }

    // Apply bounded displacement
    for (let i = 0; i < ordered.length; i++) {
      if (centerId && ordered[i].id === centerId) {
        pos[i].x = cx;
        pos[i].y = cy;
        continue;
      }
      const dx = dispX[i];
      const dy = dispY[i];
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        const step = Math.min(mag, temp);
        pos[i].x += (dx / mag) * step;
        pos[i].y += (dy / mag) * step;
      }
      pos[i].x = Math.max(padX, Math.min(width - padX, pos[i].x));
      pos[i].y = Math.max(padY, Math.min(height - padY, pos[i].y));
    }

    temp = Math.max(0.5, temp - cooling);
  }

  const out: Record<string, { x: number; y: number }> = {};
  ordered.forEach((n, idx) => {
    out[n.id] = {
      x: Math.round(pos[idx].x * 10) / 10,
      y: Math.round(pos[idx].y * 10) / 10,
    };
  });
  return out;
}

// src/sdk/devtools/dag/layout.ts

import type { Graph, GraphNode } from "./types";

export function layoutGraph(graph: Graph, canvasWidth: number): GraphNode[] {
    const levelMap = new Map<string, number>();
    const nodes = graph.nodes;
    if (nodes.length === 0) return nodes;

    function assignLevels() {
        const visited = new Set<string>();
        function dfs(nodeId: string, level: number) {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            levelMap.set(nodeId, level);
            const children = graph.edges.filter(e => e.from === nodeId).map(e => e.to);
            for (const child of children) dfs(child, level + 1);
        }
        dfs(nodes[0].id, 0);
    }
    assignLevels();

    const levelGroups: Record<number, GraphNode[]> = {};
    for (const node of nodes) {
        const level = levelMap.get(node.id) || 0;
        if (!levelGroups[level]) levelGroups[level] = [];
        levelGroups[level].push(node);
    }

    const gapY = 70;
    const nodeWidth = 130;
    const gapX = 20;

    Object.entries(levelGroups).forEach(([levelStr, group]) => {
        const level = Number(levelStr);
        const groupWidth = group.length * nodeWidth + (group.length - 1) * gapX;
        const startX = (canvasWidth - groupWidth) / 2;

        group.forEach((node, index) => {
            node.x = startX + index * (nodeWidth + gapX);
            node.y = 20 + level * gapY;
        });
    });
    return nodes;
}

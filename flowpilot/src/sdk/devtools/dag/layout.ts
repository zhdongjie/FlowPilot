// src/sdk/devtools/dag/layout.ts

import type { Graph, GraphNode } from "./types";

export function layoutGraph(graph: Graph, canvasWidth: number): GraphNode[] {
    const { nodes, edges, rootId } = graph;
    if (nodes.length === 0 || !rootId) return nodes;

    const levelMap = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();

    // 1. 初始化入度与子节点映射
    nodes.forEach(n => {
        inDegree.set(n.id, 0);
        childrenMap.set(n.id, []);
    });

    edges.forEach(e => {
        inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
        childrenMap.get(e.from)?.push(e.to);
    });

    // 2. 拓扑排序计算真正的深度 (DAG 核心算法)
    levelMap.set(rootId, 0);
    const queue = [rootId];

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const currLevel = levelMap.get(curr)!;

        const children = childrenMap.get(curr) || [];
        for (const child of children) {
            // 🌟 核心：DAG 节点的层级 = max(当前已知层级, 父层级 + 1)
            const nextLevel = Math.max(levelMap.get(child) || 0, currLevel + 1);
            levelMap.set(child, nextLevel);

            inDegree.set(child, inDegree.get(child)! - 1);
            // 入度清零时入队
            if (inDegree.get(child) === 0) {
                queue.push(child);
            }
        }
    }

    // 3. 按 level 分配坐标计算
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

import type { Graph, GraphNode } from "./types";
import { LayoutResult } from "./layout-types";

/**
 * 🌟 工业级 DAG 布局算法
 * 基于入度(In-Degree)计算拓扑层级，并进行水平居中对齐
 */
export function layoutGraph(graph: Graph, canvasWidth: number): LayoutResult {
    const { nodes, edges, rootId } = graph;
    if (nodes.length === 0) {
        return {
            nodes: [],
            nodeWidth: 130,
            nodeHeight: 36
        };
    }

    const nodeWidth = 130;
    const nodeHeight = 36;
    const gapX = 25;
    const gapY = 70;
    const paddingY = 40;

    const positionedNodes: GraphNode[] = nodes.map(n => ({ ...n }));


    const levelMap = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();

    positionedNodes.forEach(n => {
        inDegree.set(n.id, 0);
        childrenMap.set(n.id, []);
    });

    edges.forEach(e => {
        inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
        childrenMap.get(e.from)?.push(e.to);
    });

    const queue: string[] = [];

    if (rootId && inDegree.has(rootId)) {
        queue.push(rootId);
        levelMap.set(rootId, 0);
    } else {
        positionedNodes.forEach(n => {
            if (inDegree.get(n.id) === 0) {
                queue.push(n.id);
                levelMap.set(n.id, 0);
            }
        });
    }

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const currLevel = levelMap.get(curr) || 0;

        for (const childId of childrenMap.get(curr) || []) {
            const nextLevel = Math.max(levelMap.get(childId) || 0, currLevel + 1);
            levelMap.set(childId, nextLevel);

            const deg = (inDegree.get(childId) || 0) - 1;
            inDegree.set(childId, deg);

            if (deg === 0) {
                queue.push(childId);
            }
        }
    }

    // 分组
    const levelGroups = new Map<number, GraphNode[]>();

    positionedNodes.forEach(node => {
        const level = levelMap.get(node.id) ?? 0;
        if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
        }
        levelGroups.get(level)!.push(node);
    });

    // 排序 + 布局
    levelGroups.forEach((group, level) => {
        group.sort((a, b) => a.id.localeCompare(b.id));

        const totalWidth = group.length * nodeWidth + (group.length - 1) * gapX;
        const startX = (canvasWidth - totalWidth) / 2;

        group.forEach((node, i) => {
            node.x = startX + i * (nodeWidth + gapX);
            node.y = paddingY + level * gapY;
        });
    });

    return {
        nodes: positionedNodes,
        nodeWidth,
        nodeHeight
    };
}

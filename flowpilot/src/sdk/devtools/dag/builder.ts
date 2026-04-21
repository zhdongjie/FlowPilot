// src/sdk/devtools/dag/builder.ts

import { Graph, GraphEdge, GraphNode } from "./types.ts";

export function buildGraph(diagnosticRoot: any, stepId?: string): Graph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 🌟 关键：使用 path（路径）确保 ID 的绝对唯一与稳定
    function walk(node: any, path: string): string {
        // 生成确定性 ID，例如: "node_0.1.event"
        const currentId = `node_${path}_${node.type}`;

        let label = node.type.toUpperCase();
        // 针对不同类型做精细化 Label 处理
        if (node.type === 'event') label = node.details?.key || 'EVENT';
        if (node.type === 'sequence') label = `SEQ: ${node.details?.keys?.join('→')}`;
        if (node.type === 'after') label = `AFTER: ${node.details?.targetStep}`;
        if (node.type === 'timer') label = `TIMER: ${node.details?.limit}ms`;

        nodes.push({
            id: currentId,
            label,
            type: node.type,
            passed: node.passed,
            reason: node.reason,
            meta: node.details // 穿透元数据，用于 Tooltip 展示
        });

        if (node.children && node.children.length > 0) {
            node.children.forEach((child: any, index: number) => {
                // 递归时携带索引路径：0 -> 0.0 -> 0.0.1
                const childId = walk(child, `${path}.${index}`);
                edges.push({ from: currentId, to: childId });
            });
        }
        return currentId;
    }

    let rootId = "";
    if (diagnosticRoot) {
        // 处理虚拟 Step Root
        if (stepId && !['and', 'or', 'not'].includes(diagnosticRoot.type)) {
            rootId = `step_root_${stepId}`;
            nodes.push({
                id: rootId,
                label: `STEP: ${stepId}`,
                type: 'step',
                passed: diagnosticRoot.passed,
                reason: 'ROOT'
            });
            const childId = walk(diagnosticRoot, "0");
            edges.push({ from: rootId, to: childId });
        } else {
            rootId = walk(diagnosticRoot, "0");
        }
    }

    return { nodes, edges, rootId };
}

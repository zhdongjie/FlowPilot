// src/sdk/devtools/dag/builder.ts
import type { Graph, GraphNode, GraphEdge } from "./types";

let idCounter = 0;
const genId = () => `node_${idCounter++}`;

export function buildGraph(diagnosticRoot: any, stepId?: string): Graph {
    idCounter = 0;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    function walk(node: any): string {
        const currentId = genId();

        let label = node.type.toUpperCase();
        if (node.type === 'event') label = node.details?.key || 'EVENT';
        if (node.type === 'sequence') label = `SEQ [${node.details?.keys?.join(',')}]`;
        if (node.type === 'after') label = `AFTER [${node.details?.targetStep}]`;

        nodes.push({
            id: currentId,
            label,
            type: node.type,
            passed: node.passed,
            reason: node.reason
        });

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                const childId = walk(child);
                edges.push({ from: currentId, to: childId });
            }
        }
        return currentId;
    }

    if (diagnosticRoot) {
        // 如果我们传了 stepId，并且根节点不是逻辑操作符，我们人为地给它包一层
        if (stepId && !['and', 'or', 'not'].includes(diagnosticRoot.type)) {
            const rootId = genId();
            nodes.push({
                id: rootId,
                label: `STEP: ${stepId}`,
                type: 'step', // 虚拟的 step 节点
                passed: diagnosticRoot.passed,
                reason: 'ROOT'
            });
            const childId = walk(diagnosticRoot);
            edges.push({ from: rootId, to: childId });
        } else {
            walk(diagnosticRoot);
        }
    }
    return { nodes, edges };
}

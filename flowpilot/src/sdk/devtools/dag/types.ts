// src/sdk/devtools/dag/types.ts

export interface GraphNode {
    id: string;
    label: string;
    type: string;
    passed: boolean;
    reason?: string;
    x?: number;
    y?: number;
    meta?: any; // 🌟 财富密码：保留底层引擎的 details 数据
}
export interface GraphEdge {
    from: string;
    to: string;
}
export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    rootId: string; // 🌟 显式声明根节点入口
}

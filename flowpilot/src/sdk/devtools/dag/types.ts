// src/sdk/devtools/dag/types.ts

export interface GraphNode {
    id: string;
    label: string;
    type: string;
    passed: boolean;
    reason?: string;
    x?: number;
    y?: number;
}
export interface GraphEdge {
    from: string;
    to: string;
}
export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

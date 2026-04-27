// src/sdk/devtools/dag/layout-types.ts

import { GraphNode } from "./types";

export interface LayoutResult {
    nodes: GraphNode[];
    nodeWidth: number;
    nodeHeight: number;
}

// src/sdk/devtools/dag/layout-types.ts

import { GraphNode } from "./types.ts";

export interface LayoutResult {
    nodes: GraphNode[];
    nodeWidth: number;
    nodeHeight: number;
}

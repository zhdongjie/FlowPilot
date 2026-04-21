// src/sdk/devtools/dag/render-core.ts
import type { Graph, GraphNode } from "./types";
import type { LayoutResult } from "./layout-types";
import { layoutGraph } from "./layout";

export class DAGRenderCore {
    // 🌟 缓存（避免重复 layout）
    private lastGraph: Graph | null = null;
    private lastWidth: number = 0;
    private cachedLayout: LayoutResult | null = null;

    // 🌟 状态锁存（动画用）
    private readonly latchMap = new Map<string, number>();

    /**
     * 🌟 主渲染入口（纯函数 + 外部时间驱动）
     */
    public draw(
        ctx: CanvasRenderingContext2D,
        graph: Graph,
        options: {
            width: number;
            height: number;
            now: number; // 🔥 外部时间源（支持回溯/暂停）
            activeEventKey?: string | null;
            mouseX: number;
            mouseY: number;
        }
    ): GraphNode | null {
        const { width, height, now, activeEventKey, mouseX, mouseY } = options;

        // 1️⃣ 获取 layout（带缓存）
        const layout = this.getLayout(graph, width);
        const nodes = layout.nodes;
        const nodeWidth = layout.nodeWidth;
        const nodeHeight = layout.nodeHeight;

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        let hoveredNode: GraphNode | null = null;

        // 2️⃣ 清屏
        ctx.clearRect(0, 0, width, height);

        // 3️⃣ 画边
        for (const edge of graph.edges) {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) continue;

            this.drawEdge(ctx, from, to, now, nodeWidth, nodeHeight);
        }

        // 4️⃣ 画节点 + 命中检测
        for (const node of nodes) {
            this.drawNode(ctx, node, now, nodeWidth, nodeHeight, activeEventKey);

            if (
                mouseX >= node.x! &&
                mouseX <= node.x! + nodeWidth &&
                mouseY >= node.y! &&
                mouseY <= node.y! + nodeHeight
            ) {
                hoveredNode = node;
            }
        }

        return hoveredNode;
    }

    /**
     * 🌟 layout 缓存层（关键优化点）
     */
    private getLayout(graph: Graph, width: number): LayoutResult {
        if (this.lastGraph !== graph || this.lastWidth !== width) {
            this.cachedLayout = layoutGraph(graph, width);
            this.lastGraph = graph;
            this.lastWidth = width;
        }
        return this.cachedLayout!;
    }

    /**
     * 🌟 画边（带动画）
     */
    private drawEdge(
        ctx: CanvasRenderingContext2D,
        from: GraphNode,
        to: GraphNode,
        now: number,
        nodeWidth: number,
        nodeHeight: number
    ) {
        const startX = from.x! + nodeWidth / 2;
        const startY = from.y! + nodeHeight;
        const endX = to.x! + nodeWidth / 2;
        const endY = to.y!;

        const isPassed =
            to.passed || (now - (this.latchMap.get(to.id) || 0) < 800);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);

        if (isPassed) {
            ctx.strokeStyle = "#28a745";
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = "#555";
            ctx.setLineDash([6, 4]);
            ctx.lineDashOffset = -(now / 20);
            ctx.lineWidth = 1.5;
        }

        ctx.stroke();
        ctx.setLineDash([]); // 防污染
    }

    /**
     * 🌟 画节点（带状态动画）
     */
    private drawNode(
        ctx: CanvasRenderingContext2D,
        node: GraphNode,
        now: number,
        nodeWidth: number,
        nodeHeight: number,
        activeEventKey?: string | null
    ) {
        const { id, x, y, label, passed, meta } = node;

        // 🌟 锁存时间（只记录第一次通过）
        if (passed && !this.latchMap.has(id)) {
            this.latchMap.set(id, now);
        }

        const isRecentlyPassed =
            now - (this.latchMap.get(id) || 0) < 800;

        const isLinked = activeEventKey && meta?.key === activeEventKey;

        // 🌟 样式逻辑
        ctx.fillStyle = isLinked ? "#2c3e50" : "#2d2d2d";

        if (isLinked) {
            ctx.shadowColor = "#4fc3f7";
            ctx.shadowBlur = 10;
            ctx.strokeStyle = "#4fc3f7";
        } else {
            ctx.shadowBlur = 0;
            ctx.strokeStyle =
                passed || isRecentlyPassed ? "#28a745" : "#dc3545";
        }

        ctx.lineWidth =
            passed || isRecentlyPassed || isLinked ? 2.5 : 1.5;

        // 🌟 画节点
        ctx.beginPath();
        if ((ctx as any).roundRect) {
            (ctx as any).roundRect(x!, y!, nodeWidth, nodeHeight, 6);
        } else {
            ctx.rect(x!, y!, nodeWidth, nodeHeight);
        }

        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 🌟 文本
        ctx.fillStyle =
            passed || isRecentlyPassed || isLinked ? "#fff" : "#888";

        ctx.font = '11px "Fira Code", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const displayLabel =
            label.length > 14 ? label.slice(0, 12) + "..." : label;

        ctx.fillText(
            displayLabel,
            x! + nodeWidth / 2,
            y! + nodeHeight / 2
        );
    }
}

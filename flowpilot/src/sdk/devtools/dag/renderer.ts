// src/sdk/devtools/dag/renderer.ts
import type { Graph, GraphNode } from "./types";
import { layoutGraph } from "./layout";

export class DAGRenderer {
    private ctx: CanvasRenderingContext2D;
    private nodeWidth = 130;
    private nodeHeight = 36;

    private latchMap = new Map<string, number>();

    constructor(private canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    render(graph: Graph) {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);

        const nodes = layoutGraph(graph, rect.width);

        // 1. 画连线
        this.ctx.lineWidth = 2;
        for (const edge of graph.edges) {
            const from = nodes.find(n => n.id === edge.from);
            const to = nodes.find(n => n.id === edge.to);
            if (!from || !to) continue;

            this.ctx.strokeStyle = '#555';
            this.ctx.beginPath();
            this.ctx.moveTo(from.x! + this.nodeWidth / 2, from.y! + this.nodeHeight);
            this.ctx.lineTo(to.x! + this.nodeWidth / 2, to.y!);
            this.ctx.stroke();
        }

        // 2. 画节点
        for (const node of nodes) {
            this.drawNode(node);
        }
    }

    private drawNode(node: GraphNode) {
        const { id, x, y, label, passed, type } = node;
        const isOperator = type === 'and' || type === 'or' || type === 'not';

        // 🌟 核心：视觉伪造逻辑
        // 如果当前数据是 passed，或者在过去 800ms 内变绿过，则保持绿色显示
        if (passed) {
            this.latchMap.set(id, Date.now());
        }

        const now = Date.now();
        const lastPassedTime = this.latchMap.get(id) || 0;
        const isVisibleGreen = passed || (now - lastPassedTime < 800);

        this.ctx.fillStyle = '#2d2d2d';
        this.ctx.strokeStyle = isVisibleGreen ? '#28a745' : '#dc3545'; // 🟢 绿灯 vs 🔴 红灯
        this.ctx.lineWidth = isVisibleGreen ? 3 : 2;

        // 绘制矩形
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(x!, y!, this.nodeWidth, this.nodeHeight, isOperator ? 18 : 6);
        } else {
            this.ctx.rect(x!, y!, this.nodeWidth, this.nodeHeight);
        }
        this.ctx.fill();
        this.ctx.stroke();

        // 绘制文本
        this.ctx.fillStyle = isVisibleGreen ? '#e0e0e0' : '#888';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const displayLabel = label.length > 16 ? label.substring(0, 14) + '...' : label;
        this.ctx.fillText(displayLabel, x! + this.nodeWidth / 2, y! + this.nodeHeight / 2);
    }
}

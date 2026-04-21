// src/sdk/devtools/dag/renderer.ts
import type { Graph, GraphNode } from "./types";
import { layoutGraph } from "./layout";

export class DAGRenderer {
    private ctx: CanvasRenderingContext2D;
    private nodeWidth = 130;
    private nodeHeight = 36;
    private dpr: number;

    private currentGraph: Graph | null = null;
    private activeEventKey: string | null = null;

    private animationId: number = 0;
    private time = 0;
    private latchMap = new Map<string, number>();

    // 交互状态
    private mouseX = -1;
    private mouseY = -1;

    constructor(private canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext("2d")!;
        this.dpr = window.devicePixelRatio || 1;
        this.resize();

        canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
        canvas.addEventListener('mouseleave', () => { this.mouseX = -1; this.mouseY = -1; });
    }

    private resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
    }

    // 🌟 接收新数据
    public updateData(graph: Graph, activeEventKey?: string | null) {
        this.currentGraph = graph;
        this.activeEventKey = activeEventKey || null;
    }

    // 🌟 启动游戏引擎循环
    public start() {
        const loop = () => {
            this.time++;
            this.drawFrame();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    public stop() {
        cancelAnimationFrame(this.animationId);
    }

    private updateMouse(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }

    private drawFrame() {
        if (!this.currentGraph) return;
        const rect = this.canvas.getBoundingClientRect();

        // 🌟 修复 V2: 逻辑像素与物理像素的错位问题
        this.ctx.clearRect(0, 0, rect.width, rect.height);

        const nodes = layoutGraph(this.currentGraph, rect.width);

        // 🌟 O(1) 性能优化
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        let hoveredNode: GraphNode | null = null;

        // 1. 画流动边线
        this.ctx.lineWidth = 2;
        for (const edge of this.currentGraph.edges) {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) continue;

            const startX = from.x! + this.nodeWidth / 2;
            const startY = from.y! + this.nodeHeight;
            const endX = to.x! + this.nodeWidth / 2;
            const endY = to.y!;

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);

            // 🌟 动画：流动数据线
            const isTargetPassed = to.passed || (Date.now() - (this.latchMap.get(to.id) || 0) < 800);
            if (isTargetPassed) {
                this.ctx.strokeStyle = '#28a745';
                this.ctx.setLineDash([]);
            } else {
                this.ctx.strokeStyle = '#555';
                this.ctx.setLineDash([8, 8]);
                this.ctx.lineDashOffset = -this.time * 0.5; // 让虚线流动
            }
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // 2. 画节点
        for (const node of nodes) {
            this.drawNode(node);
            if (this.mouseX >= node.x! && this.mouseX <= node.x! + this.nodeWidth &&
                this.mouseY >= node.y! && this.mouseY <= node.y! + this.nodeHeight) {
                hoveredNode = node;
            }
        }

        // 3. Tooltip 必须在顶层渲染
        if (hoveredNode) {
            this.drawTooltip(hoveredNode);
            this.canvas.style.cursor = 'help';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    private drawNode(node: GraphNode) {
        const { id, x, y, label, passed, type, meta } = node;
        const isOperator = type === 'and' || type === 'or' || type === 'not';

        if (passed) this.latchMap.set(id, Date.now());
        const isVisibleGreen = passed || (Date.now() - (this.latchMap.get(id) || 0) < 800);

        // 🌟 联动高亮：判断是否被时间轴悬停
        const isLinkedActive = this.activeEventKey && meta?.key === this.activeEventKey;

        this.ctx.fillStyle = isLinkedActive ? '#2c3e50' : '#2d2d2d';

        if (isLinkedActive) {
            this.ctx.shadowColor = '#4fc3f7';
            this.ctx.shadowBlur = 15;
            this.ctx.strokeStyle = '#4fc3f7';
        } else {
            this.ctx.shadowBlur = 0;
            this.ctx.strokeStyle = isVisibleGreen ? '#28a745' : '#dc3545';
        }

        this.ctx.lineWidth = isVisibleGreen || isLinkedActive ? 3 : 2;

        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(x!, y!, this.nodeWidth, this.nodeHeight, isOperator ? 18 : 6);
        } else {
            this.ctx.rect(x!, y!, this.nodeWidth, this.nodeHeight);
        }
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        this.ctx.fillStyle = isVisibleGreen || isLinkedActive ? '#ffffff' : '#888';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const displayLabel = label.length > 14 ? label.substring(0, 12) + '...' : label;
        this.ctx.fillText(displayLabel, x! + this.nodeWidth / 2, y! + this.nodeHeight / 2);
    }

    private drawTooltip(node: GraphNode) {
        if (!node.meta && !node.reason) return;

        const pad = 10;
        const textLines = [];
        if (node.reason) textLines.push(`[Status] ${node.reason}`);
        if (node.meta?.limit) textLines.push(`limit: ${node.meta.limit}ms`);
        if (node.meta?.elapsed !== undefined) textLines.push(`elapsed: ${node.meta.elapsed}ms`);
        if (node.meta?.required) textLines.push(`count: ${node.meta.current}/${node.meta.required}`);

        if (textLines.length === 0) return;

        this.ctx.font = '11px monospace';
        this.ctx.textAlign = 'left';

        const maxTextWidth = Math.max(...textLines.map(t => this.ctx.measureText(t).width));
        const boxW = maxTextWidth + pad * 2;
        const boxH = textLines.length * 16 + pad * 2;

        let tipX = this.mouseX + 15;
        let tipY = this.mouseY + 15;
        const rect = this.canvas.getBoundingClientRect();
        if (tipX + boxW > rect.width) tipX = this.mouseX - boxW - 15;
        if (tipY + boxH > rect.height) tipY = this.mouseY - boxH - 15;

        this.ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        if (this.ctx.roundRect) this.ctx.roundRect(tipX, tipY, boxW, boxH, 4);
        else this.ctx.rect(tipX, tipY, boxW, boxH);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#4fc3f7';
        textLines.forEach((line, i) => {
            this.ctx.fillText(line, tipX + pad, tipY + pad + 8 + i * 16);
        });
    }
}

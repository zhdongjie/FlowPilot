// src/sdk/devtools/viewer/dag-viewer.ts
import { DAGRenderCore } from "../dag/render-core";
import { buildGraph } from "../dag/builder";
import type { FlowDevTools } from "../controller";

export class DAGViewer {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private readonly renderer = new DAGRenderCore();
    private animationId = 0;

    // 🌟 新增：替换掉旧的 window.resize，完美解决初始化宽高为 0 的白屏问题
    private resizeObserver!: ResizeObserver;

    private mouseX = -1;
    private mouseY = -1;
    private isRunning = false;

    // 🌟🌟 摄像机状态机 🌟🌟
    private displayStepId: string | null = null;
    private holdUntil: number = 0;

    constructor(
        private readonly devtools: FlowDevTools,
        private readonly container: HTMLElement
    ) {}

    mount() {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d")!;

        this.canvas.style.display = "block";

        this.canvas.style.position = "absolute";
        this.canvas.style.top = "50";
        this.canvas.style.left = "0";

        this.container.appendChild(this.canvas);

        this.resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            if (width === 0 || height === 0) return;

            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;

            // 重置变换矩阵并重新缩放，防止多次触发导致画面无限放大
            this.ctx.resetTransform();
            this.ctx.scale(dpr, dpr);
        });
        this.resizeObserver.observe(this.container);

        this.canvas.addEventListener("mousemove", this.onMouseMove);
        this.canvas.addEventListener("mouseleave", this.onMouseLeave);

        this.isRunning = true;
        this.loop();
    }

    unmount() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationId);
        this.resizeObserver?.disconnect(); // 🌟 清理 Observer
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
    }

    private readonly onMouseMove = (e: MouseEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    };

    private readonly onMouseLeave = () => {
        this.mouseX = -1;
        this.mouseY = -1;
    };

    private readonly loop = () => {
        if (!this.isRunning) return;
        const now = performance.now();
        const rect = this.container.getBoundingClientRect();

        // 🌟🌟 1. 优先级最高：时光机视角 (Time Machine Hover)
        // 从 Controller 获取用户鼠标当前正悬停在时间线上的哪个历史 StepId
        const timeMachineStepId = this.devtools.getHoveredHistoryStepId();

        // 🌟🌟 2. 真实物理视角
        const diagnostics = this.devtools.getActiveDiagnostics();
        const realActiveId = diagnostics[0]?.stepId || null;

        let targetRenderStepId: string | null = null;

        // 如果用户在看时光机，直接强行切镜头，忽略所有动画锁存！
        if (timeMachineStepId) {
            targetRenderStepId = timeMachineStepId;
            this.displayStepId = timeMachineStepId; // 顺便同步摄像机
            this.holdUntil = 0;                     // 打断之前的通关动画锁
        } else {
            // 否则，走你原有的精妙“摄像机状态机”逻辑
            if (realActiveId !== this.displayStepId) {
                if (this.displayStepId && this.holdUntil === 0) {
                    const state = this.devtools.getDebugEngine()?.inspect();
                    const isCompleted = state?.completedSteps.includes(this.displayStepId);
                    if (isCompleted) {
                        // 如果它在完成名单里，强制锁存屏幕 1000ms 播放通关特效！
                        this.holdUntil = now + 1000;
                    } else {
                        // 否则（比如用户主动重置/回退），立刻切镜头
                        this.displayStepId = realActiveId;
                    }
                } else if (!this.displayStepId) {
                    this.displayStepId = realActiveId;
                }
            }

            if (this.holdUntil > 0 && now >= this.holdUntil) {
                this.displayStepId = realActiveId;
                this.holdUntil = 0;
            }

            targetRenderStepId = this.displayStepId;
        }

        // 🌟🌟 3. 开始执行渲染
        const targetDiag = targetRenderStepId
            ? this.devtools.getDiagnostic(targetRenderStepId)
            : null;

        // 如果画板尺寸有效才绘制
        if (rect.width > 0 && rect.height > 0) {
            this.ctx.clearRect(0, 0, rect.width, rect.height); // 每帧必须清空！

            if (targetDiag && targetDiag.tree) {
                const graph = buildGraph(targetDiag.tree, targetDiag.stepId);
                const hovered = this.renderer.draw(this.ctx, graph, {
                    width: rect.width,
                    height: rect.height,
                    now: now,
                    activeEventKey: this.devtools.getHoveredEventKey(),
                    mouseX: this.mouseX,
                    mouseY: this.mouseY
                });
                this.canvas.style.cursor = hovered ? 'help' : 'default';
            } else if (!timeMachineStepId && this.devtools.isFlowFinished()) {
                // 只有在没看时光机，且真实世界已结束时，才画完成画面
                const finishedGraph: any = {
                    rootId: "flow_finished",
                    nodes: [{
                        id: "flow_finished",
                        label: "🎉 所有流程执行完毕",
                        type: "step",
                        passed: true,
                        reason: "ALL_DONE"
                    }],
                    edges: []
                };

                const hovered = this.renderer.draw(this.ctx, finishedGraph, {
                    width: rect.width,
                    height: rect.height,
                    now: now,
                    activeEventKey: null,
                    mouseX: this.mouseX,
                    mouseY: this.mouseY
                });
                this.canvas.style.cursor = hovered ? 'help' : 'default';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }

        this.animationId = requestAnimationFrame(this.loop);
    };
}

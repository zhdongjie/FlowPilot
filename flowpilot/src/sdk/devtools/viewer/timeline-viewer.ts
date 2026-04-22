// src/sdk/devtools/viewer/timeline-viewer.ts

import type { FlowDevTools } from "../controller";
import type { FlowRuntime } from "../../runtime/runtime";

export class TimelineViewer {
    private listRoot!: HTMLDivElement;
    private unsubscribe: (() => void) | null = null;

    constructor(
        private readonly devtools: FlowDevTools,
        private readonly runtime: FlowRuntime,
        private readonly container: HTMLElement
    ) {}

    mount() {
        this.listRoot = document.createElement("div");
        Object.assign(this.listRoot.style, {
            height: "100%",
            overflowY: "auto",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
        });
        this.container.appendChild(this.listRoot);

        // 🌟 监听控制器广播，拉取最新事件
        this.unsubscribe = this.devtools.emitter.subscribe(() => {
            this.render();
        });

        this.render();
    }

    unmount() {
        this.unsubscribe?.();
    }

    private render() {
        // 倒序展示，最新事件在上方
        const events = [...this.devtools.getEvents()].reverse();
        this.listRoot.innerHTML = "";

        if (events.length === 0) {
            this.listRoot.innerHTML = `<div style="color: #666; text-align: center; padding: 20px;">暂无历史记录</div>`;
            return;
        }

        events.forEach(event => {
            const card = document.createElement("div");
            this.styleEventCard(card, event);

            const timeStr = new Date(event.timestamp).toLocaleTimeString();

            card.innerHTML = `
                <div style="font-size: 10px; color: #666;">${timeStr}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="font-size: 12px;">
                        <b style="color: #f39c12;">${event.type}</b> 
                        <i style="color: #aaa; margin-left: 6px;">${event.key || event.stepId || ''}</i>
                    </span>
                    <button class="fp-rewind-btn" style="opacity: 0; background: none; border: none; cursor: pointer; transition: 0.2s;">⏪</button>
                </div>
            `;

            const rewindBtn = card.querySelector('.fp-rewind-btn') as HTMLElement;

            // 🌟 交互：联动 DAG 高亮
            card.onmouseenter = () => {
                card.style.background = "#333333";
                rewindBtn.style.opacity = "1";
                this.devtools.setHoveredEventKey(event.key || null);
            };

            card.onmouseleave = () => {
                card.style.background = "#252526";
                rewindBtn.style.opacity = "0";
                this.devtools.setHoveredEventKey(null);
            };

            // 🌟 交互：时光回溯
            rewindBtn.onclick = (e) => {
                e.stopPropagation();
                // 打破次元壁，回溯真实世界
                this.devtools.rewindTime(this.runtime, event.timestamp);
            };

            this.listRoot.appendChild(card);
        });
    }

    private styleEventCard(el: HTMLElement, event: any) {
        Object.assign(el.style, {
            background: "#252526",
            padding: "8px 12px",
            borderRadius: "6px",
            borderLeft: "4px solid #444",
            transition: "all 0.2s ease"
        });

        // 类型色彩标识
        if (event.type === 'STEP_ACTIVATE') el.style.borderLeftColor = "#007aff";
        if (event.type === 'STEP_COMPLETE') el.style.borderLeftColor = "#28a745";
        if (event.type === 'SIGNAL_INGEST') el.style.borderLeftColor = "#f39c12";
        if (event.type === 'REVERT') el.style.borderLeftColor = "#dc3545";
    }
}

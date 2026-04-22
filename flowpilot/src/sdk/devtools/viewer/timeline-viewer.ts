// src/sdk/devtools/viewer/timeline-viewer.ts

import type { FlowDevTools } from "../controller";
import type { FlowRuntime } from "../../runtime/runtime";

export class TimelineViewer {
    private listRoot!: HTMLDivElement;
    private unsubscribe: (() => void) | null = null;
    private lastEventCount = -1;

    constructor(
        private readonly devtools: FlowDevTools,
        private readonly runtime: FlowRuntime,
        private readonly container: HTMLElement
    ) {
        this.injectStyles();
    }

    mount() {
        this.listRoot = document.createElement("div");
        Object.assign(this.listRoot.style, {
            height: "100%", overflowY: "auto", padding: "8px",
            display: "flex", flexDirection: "column", gap: "8px"
        });
        this.container.appendChild(this.listRoot);

        this.unsubscribe = this.devtools.emitter.subscribe(() => {
            const events = this.devtools.getEvents();
            // 🌟 只有当事件数量变化时才重新渲染列表，避免 Hover 导致的广播引起重绘
            if (events.length !== this.lastEventCount) {
                this.render();
                this.lastEventCount = events.length;
            }
        });

        this.render();
    }

    unmount() {
        this.unsubscribe?.();
    }

    private render() {
        const events = [...this.devtools.getEvents()].reverse();
        this.listRoot.innerHTML = "";

        events.forEach(event => {
            const card = document.createElement("div");
            card.className = "fp-event-card"; // 🌟 使用 CSS Class

            // 设定不同类型的边框颜色
            this.styleEventCard(card, event);

            card.innerHTML = `
                <div style="font-size: 10px; color: #666;">${new Date(event.timestamp).toLocaleTimeString()}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="font-size: 12px;">
                        <b style="color: #f39c12;">${event.type}</b> 
                        <i style="color: #aaa; margin-left: 6px;">${event.key || event.stepId || ''}</i>
                    </span>
                    <button class="fp-rewind-btn">回溯</button>
                </div>
            `;

            // 🌟 仅处理联动逻辑，不操作 DOM
            card.onmouseenter = () => {
                this.devtools.setHoveredEventKey(event.key || null);
            };
            card.onmouseleave = () => {
                this.devtools.setHoveredEventKey(null);
            };

            // 🌟 回溯按钮点击
            const rewindBtn = card.querySelector('.fp-rewind-btn') as HTMLElement;
            rewindBtn.onclick = (e) => {
                e.stopPropagation();
                console.log("⏪ 正在回溯至:", event.timestamp);
                this.devtools.rewindTime(this.runtime, event.timestamp);
            };

            this.listRoot.appendChild(card);
        });
    }

    private styleEventCard(el: HTMLElement, event: any) {
        // 类型色彩标识
        if (event.type === 'STEP_ACTIVATE') el.style.borderLeftColor = "#007aff";
        if (event.type === 'STEP_COMPLETE') el.style.borderLeftColor = "#28a745";
        if (event.type === 'SIGNAL_INGEST') el.style.borderLeftColor = "#f39c12";
        if (event.type === 'REVERT') el.style.borderLeftColor = "#dc3545";
    }

    private injectStyles() {
        if (document.getElementById('fp-timeline-styles')) return;
        const style = document.createElement('style');
        style.id = 'fp-timeline-styles';
        style.innerHTML = `
            .fp-event-card {
                background: #252526;
                padding: 8px 12px;
                border-radius: 6px;
                border-left: 4px solid #444;
                transition: background 0.2s;
                cursor: pointer;
            }
            .fp-event-card:hover {
                background: #333 !important;
            }
            .fp-rewind-btn {
                background: #444;
                color: #fff;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
            }
            
            .fp-rewind-btn:hover {
                background: #007aff !important;
            }
        `;
        document.head.appendChild(style);
    }

}

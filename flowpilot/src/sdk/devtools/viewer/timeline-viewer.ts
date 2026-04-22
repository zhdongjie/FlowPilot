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
        const allEvents = [...this.devtools.getEvents()].reverse();

        // 🌟🌟🌟 核心过滤与清洗逻辑 🌟🌟🌟
        const displayEvents = allEvents.filter(event => {
            // 1. 过滤掉引擎内部瞬间结算产生的噪音
            if (event.type === 'FACT_APPLIED' || event.type === 'STEP_ADVANCE') {
                return false;
            }
            return true;
        });

        this.listRoot.innerHTML = "";

        displayEvents.forEach(event => {
            const card = document.createElement("div");
            card.className = "fp-event-card";
            this.styleEventCard(card, event);

            // 🌟 判断是否是高频的、无需回溯的“噪音输入”
            const isNoiseSignal = event.type === 'SIGNAL_INGEST' &&
                (event.key?.startsWith('focus_') || event.key?.startsWith('blur_') || event.key?.startsWith('input_'));

            if (isNoiseSignal) {
                // 如果是焦点事件，让它变灰，且不显示回溯按钮
                card.style.opacity = "0.5";
                card.style.borderLeftColor = "#555";
                card.innerHTML = `
                    <div style="font-size: 10px; color: #666;">${new Date(event.timestamp).toLocaleTimeString()}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <span style="font-size: 12px; color: #888;">
                            <i>${event.key}</i>
                        </span>
                    </div>
                `;
            } else {
                // 如果是重要事件（步骤切换、关键点击、网络请求）
                const titleColor = event.type === 'STEP_ACTIVATE' ? '#007aff' :
                    event.type === 'SIGNAL_INGEST' ? '#f39c12' : '#fff';

                card.innerHTML = `
                    <div style="font-size: 10px; color: #666;">${new Date(event.timestamp).toLocaleTimeString()}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <span style="font-size: 12px;">
                            <b style="color: ${titleColor};">${event.type}</b> 
                            <i style="color: #ccc; margin-left: 6px;">${event.key || event.stepId || ''}</i>
                        </span>
                        <button class="fp-rewind-btn" style="
                            background: #007aff; 
                            color: #fff; 
                            border: none; 
                            cursor: pointer; 
                            padding: 4px 8px; 
                            border-radius: 4px; 
                            font-size: 10px; 
                            font-weight: bold;
                        ">⏪ 回溯</button>
                    </div>
                `;

                // 绑定回溯事件
                const rewindBtn = card.querySelector('.fp-rewind-btn') as HTMLElement;
                rewindBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.devtools.rewindTime(this.runtime, event.timestamp);
                };
            }

            // 保持 DAG 高亮联动
            card.onmouseenter = () => this.devtools.setHoveredEventKey(event.key || null);
            card.onmouseleave = () => this.devtools.setHoveredEventKey(null);

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

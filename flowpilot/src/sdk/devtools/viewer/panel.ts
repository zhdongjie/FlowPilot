// src/sdk/devtools/viewer/panel.ts
import { DAGViewer } from "./dag-viewer";
import { TimelineViewer } from "./timeline-viewer";
import type { FlowDevTools } from "../controller";
import type { FlowRuntime } from "../../runtime/runtime";

export class FlowDevToolsPanel {
    private root!: HTMLDivElement;
    private dag!: DAGViewer;
    private timeline!: TimelineViewer;

    constructor(private readonly options: {
        devtools: FlowDevTools;
        runtime: FlowRuntime; // 必须注入真实运行时
        container?: HTMLElement; // 可选的挂载点，默认 body
    }) {}

    mount() {
        const { devtools, runtime, container = document.body } = this.options;

        this.root = document.createElement("div");
        this.root.className = "fp-devtools-panel";

        Object.assign(this.root.style, {
            position: "fixed",
            right: "20px",
            top: "20px",
            width: "380px",
            height: "80vh",
            minHeight: "500px",
            background: "#1e1e1e",
            color: "#e0e0e0",
            zIndex: "2147483647", // 极致的 z-index 防止被业务遮盖
            display: "flex",
            flexDirection: "column",
            borderRadius: "12px",
            border: "1px solid #333",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
            overflow: "hidden"
        });

        // 1. Header 区域
        const header = this.createHeader();

        // 2. DAG 渲染区域 (固定高度)
        const dagContainer = document.createElement("div");
        dagContainer.style.flex = "0 0 260px";
        dagContainer.style.borderBottom = "1px solid #333";
        dagContainer.style.background = "#181818";

        // 3. 时间轴区域 (自适应高度)
        const timelineContainer = document.createElement("div");
        timelineContainer.style.flex = "1";
        timelineContainer.style.overflow = "hidden";

        this.root.appendChild(header);
        this.root.appendChild(dagContainer);
        this.root.appendChild(timelineContainer);
        container.appendChild(this.root);

        // 实例化子视图
        this.dag = new DAGViewer(devtools, dagContainer);
        this.timeline = new TimelineViewer(devtools, runtime, timelineContainer);

        this.dag.mount();
        this.timeline.mount();
    }

    unmount() {
        this.dag.unmount();
        this.timeline.unmount();
        this.root.remove();
    }

    private createHeader() {
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "12px 16px",
            background: "#252526",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #333"
        });

        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 8px; height: 8px; background: #28a745; border-radius: 50%; box-shadow: 0 0 8px #28a745;"></div>
                <span style="font-weight: 600; font-size: 13px; letter-spacing: 0.5px;">FlowPilot DevTools</span>
            </div>
            <button class="fp-reset-btn" style="background:#dc3545; border:none; color:#fff; cursor:pointer; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:bold;">
                重启引擎
            </button>
        `;

        header.querySelector('.fp-reset-btn')?.addEventListener('click', () => {
            this.options.runtime.reset();
        });

        return header;
    }
}

// src/sdk/collector/dom.ts
import { FlowConfig } from "../types";

export class DOMCollector {
    private onEventCallback?: (signal: { key: string; meta?: any }) => void;
    private readonly runtimeConfig: FlowConfig['runtime'];

    constructor(runtimeConfig: FlowConfig['runtime']) {
        this.runtimeConfig = runtimeConfig;
    }

    onEvent(cb: (signal: { key: string; meta?: any }) => void) {
        this.onEventCallback = cb;
    }

    start() {
        // 1. 监听点击事实 (保持不变)
        document.addEventListener("click", this.handleDOMEvent.bind(this), true);
        // 2. 新增：监听表单聚焦事实
        document.addEventListener("focusin", this.handleDOMEvent.bind(this), true);
        document.addEventListener("focusout", this.handleDOMEvent.bind(this), true);
        document.addEventListener("input", this.handleDOMEvent.bind(this), true);
    }

    // 把提取逻辑抽离成通用方法
    private handleDOMEvent(e: Event) {
        let el = e.target as HTMLElement | null;
        while (el && el !== document.body) {
            const fpKey = el.getAttribute(this.runtimeConfig.attributeName);
            if (fpKey) {
                // 自动转换事件前缀
                let prefix = this.runtimeConfig.signalPrefix.click;
                if (e.type === "focusin") prefix = this.runtimeConfig.signalPrefix.focus;
                if (e.type === "focusout") prefix = this.runtimeConfig.signalPrefix.blur;
                if (e.type === "input") prefix = this.runtimeConfig.signalPrefix.input;

                this.onEventCallback?.({
                    key: `${prefix}${fpKey}`, // 直接拼接，不再硬编码下划线
                    meta: { tagName: el.tagName, value: (el as HTMLInputElement).value }
                });
                return;
            }
            el = el.parentElement;
        }
    }
}

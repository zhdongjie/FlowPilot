// src/sdk/collector/dom.ts
export class DOMCollector {
    private onEventCallback?: (signal: { key: string; meta?: any }) => void;

    onEvent(cb: (signal: { key: string; meta?: any }) => void) {
        this.onEventCallback = cb;
    }

    start() {
        // 1. 监听点击事实 (保持不变)
        document.addEventListener("click", this.handleDOMEvent.bind(this), true);

        // 🌟 2. 新增：监听表单聚焦事实
        document.addEventListener("focusin", this.handleDOMEvent.bind(this), true);

        document.addEventListener("focusout", this.handleDOMEvent.bind(this), true);
        document.addEventListener("input", this.handleDOMEvent.bind(this), true);
    }

    // 把提取逻辑抽离成通用方法
    private handleDOMEvent(e: Event) {
        let el = e.target as HTMLElement | null;
        while (el && el !== document.body) {
            const key = el.getAttribute("data-fp");
            if (key) {
                // 🌟 自动转换事件前缀
                let eventPrefix = "click";
                if (e.type === "focusin") eventPrefix = "focus";
                if (e.type === "focusout") eventPrefix = "blur";
                if (e.type === "input") eventPrefix = "input";

                this.onEventCallback?.({
                    key: `${eventPrefix}_${key}`, // 生成如: blur_id_card, input_id_card
                    meta: { tagName: el.tagName, value: (el as HTMLInputElement).value }
                });
                return;
            }
            el = el.parentElement;
        }
    }
}

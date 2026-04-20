// src/sdk/collector/dom.ts
export class DOMCollector {
    private onEventCallback?: (signal: { key: string; meta?: any }) => void;

    onEvent(cb: (signal: { key: string; meta?: any }) => void) {
        this.onEventCallback = cb;
    }

    start() {
        document.addEventListener("click", (e) => {
            let el = e.target as HTMLElement | null;
            while (el && el !== document.body) {
                const key = el.getAttribute("data-fp");
                if (key) {
                    // 🌟 统一规范：如果 data-fp="click_login_btn"，就发出这个 key
                    this.onEventCallback?.({
                        key: key,
                        meta: { tagName: el.tagName }
                    });
                    return; // 捕获后立即停止冒泡寻找
                }
                el = el.parentElement;
            }
        }, true);
    }
}

// src/sdk/guide/dom-tracker.ts

export class DOMTracker {
    /**
     * 立即查询
     */
    find(selector: string): HTMLElement | null {
        return document.querySelector(selector) as HTMLElement | null;
    }

    /**
     * 🚀 工业级异步等待：利用 MutationObserver 监听 DOM 变化
     * 解决 Vue/React 异步渲染导致元素还没出来的问题
     */
    async waitFor(selector: string, timeout = 3000): Promise<HTMLElement | null> {
        // 1. 先尝试立即获取，如果已经在了直接返回
        const el = this.find(selector);
        if (el) return el;

        // 2. 如果不在，启动观察者模式
        return new Promise((resolve) => {
            const observer = new MutationObserver(() => {
                const target = this.find(selector);
                if (target) {
                    observer.disconnect(); // 找到后立即停止观察
                    resolve(target);
                }
            });

            // 监听整个 body 的子节点变化及深层嵌套变化
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 3. 超时保护：防止页面一直没渲染该元素导致 Promise 挂死
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }
}

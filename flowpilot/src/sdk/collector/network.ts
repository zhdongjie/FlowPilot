// src/sdk/collector/network.ts
export class NetworkCollector {
    private onEventCallback?: (signal: { key: string; meta?: any }) => void;

    onEvent(cb: (signal: { key: string; meta?: any }) => void) {
        this.onEventCallback = cb;
    }

    start() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const res = await originalFetch(...args);
            // 简单演示：成功后发射信号
            if (res.ok) {
                this.onEventCallback?.({
                    key: "network:success",
                    meta: { url: args[0] }
                });
            }
            return res;
        };
    }
}

// flowpilot/src/sdk/collector/network.ts
import type { NetworkAdapter, EmitFunction } from "../types";

export class NetworkCollector {
    private adapters: NetworkAdapter[];
    private onEventCallback?: EmitFunction;

    constructor(adapters: NetworkAdapter[] = []) {
        this.adapters = adapters;
    }

    onEvent(cb: EmitFunction) {
        this.onEventCallback = cb;
    }

    start() {
        if (!this.onEventCallback) return;
        this.adapters.forEach(adapter => {
            adapter.install((signal) => {
                this.onEventCallback!(signal);
            });
        });
    }
}

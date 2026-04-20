// flowpilot/src/sdk/collector/collector.ts
import type { FlowRuntime } from "../runtime/runtime";
import { DOMCollector } from "./dom";
import { NetworkCollector } from "./network";
import type { NetworkAdapter } from "../types";

export class BehaviorCollector {
    private readonly runtime: FlowRuntime;
    private readonly dom = new DOMCollector();
    private readonly net: NetworkCollector;

    constructor(runtime: FlowRuntime, adapters: NetworkAdapter[] = []) {
        this.runtime = runtime;
        this.net = new NetworkCollector(adapters);
    }

    mount() {
        this.dom.onEvent((signal) => this.emit(signal));
        this.net.onEvent((signal) => this.emit(signal));
        this.dom.start();
        this.net.start();
    }

    private emit(signal: { key: string; meta?: any }) {
        this.runtime.dispatch({
            id: `sig_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            key: signal.key,
            timestamp: Date.now(),
            meta: signal.meta
        });
    }
}

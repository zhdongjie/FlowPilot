// src/sdk/collector/collector.ts
import type { FlowRuntime } from "../runtime/runtime";
import { DOMCollector } from "./dom";
import { NetworkCollector } from "./network";

export class BehaviorCollector {
    private runtime: FlowRuntime;

    private dom = new DOMCollector();
    private net = new NetworkCollector();

    constructor(runtime: FlowRuntime) {
        this.runtime = runtime;
    }

    mount() {
        this.dom.onEvent((signal) => this.emit(signal));
        this.net.onEvent((signal) => this.emit(signal));

        this.dom.start();
        this.net.start();
    }

    private emit(signal: { key: string; meta?: any }) {
        this.runtime.dispatch({
            id: `sig_${Date.now()}_${Math.random()}`,
            key: signal.key,
            timestamp: Date.now(),
            meta: signal.meta
        });
    }
}

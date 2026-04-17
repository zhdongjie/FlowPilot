// src/sdk/core/store.ts

import type { Signal } from "../types";

export class SignalStore {
    private events: Signal[] = [];
    private readonly seen = new Set<string>();

    /**
     * @returns boolean - 返回 true 表示新信号存入成功，false 表示信号重复已被拦截
     */
    push(signal: Signal): boolean {
        if (this.seen.has(signal.id)) return false;

        this.events.push(signal);
        this.seen.add(signal.id);
        return true;
    }

    getEvents() { return this.events; }

    clear() {
        this.events = [];
        this.seen.clear();
    }

}

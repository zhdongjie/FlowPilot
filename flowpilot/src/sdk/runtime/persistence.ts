// src/sdk/runtime/persistence.ts
import type { Signal } from "../types";

export class Persistence {
    private readonly key: string = "__flowpilot_history__";

    save(signals: Signal[]) {
        localStorage.setItem(this.key, JSON.stringify(signals));
    }

    load(): Signal[] {
        const raw = localStorage.getItem(this.key);
        try {
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    clear() {
        localStorage.removeItem(this.key);
    }
}

// src/sdk/core/resolver.ts

import type { Step } from "../types/step";
import type { SignalStore } from "./store";

export class FlowResolver {

    static resolve(
        steps: Step[],
        store: SignalStore,
        startIndex: number
    ): number {
        let index = startIndex;

        while (index < steps.length) {
            const step = steps[index];

            // ❗fact 直接跳过
            if (store.hasFact(step.complete)) {
                index++;
                continue;
            }

            // 找到第一个未满足 step
            return index;
        }

        return steps.length;
    }
}

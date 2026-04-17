// src/sdk/core/projection.ts

import type { Signal } from "../types/signal";

export class Projection {

    /**
     * fact：在某个时间点之前是否成立
     */
    static hasFactBefore(
        signals: Signal[],
        key: string,
        beforeTs: number
    ): boolean {
        for (let i = signals.length - 1; i >= 0; i--) {
            const s = signals[i];

            if (s.timestamp >= beforeTs) continue;

            if (s.key === key) return true;
        }
        return false;
    }

    /**
     * fact：全局存在性
     */
    static hasFact(signals: Signal[], key: string): boolean {
        for (let i = signals.length - 1; i >= 0; i--) {
            if (signals[i].key === key) return true;
        }
        return false;
    }

    /**
     * fact：在某个时间点之后是否成立
     */
    static hasFactAfter(
        signals: Signal[],
        key: string,
        afterTs: number
    ): boolean {
        for (let i = signals.length - 1; i >= 0; i--) {
            const s = signals[i];

            if (s.timestamp < afterTs) continue;

            if (s.key === key) return true;
        }
        return false;
    }

    /**
     * step 是否在当前时间下满足（关键新增）
     */
    static isStepSatisfiedAt(
        signals: Signal[],
        step: any,
        currentStepActivatedAt: number
    ): boolean {
        return this.hasFactBefore(
            signals,
            step.complete,
            currentStepActivatedAt
        );
    }

    /**
     * event 是否“有效触发”
     */
    static isValidEvent(
        signal: Signal,
        step: any
    ): boolean {
        return signal.key === step.complete;
    }
}

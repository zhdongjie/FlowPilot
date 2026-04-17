// src/sdk/core/engine.ts

import { SignalStore } from "./store";
import { FlowResolver } from "./resolver";
import type { Step } from "../types/step";
import type { Signal } from "../types/signal";

export class FlowEngine {
    steps: Step[];
    currentIndex = 0;
    store = new SignalStore();

    constructor(steps: Step[]) {
        this.steps = structuredClone(steps);
        this.bootstrap();
    }

    // -------------------------
    // Bootstrap（纯计算）
    // -------------------------
    private bootstrap() {
        this.currentIndex = FlowResolver.resolve(
            this.steps,
            this.store,
            0
        );

        this.activateStep();
    }

    get currentStep() {
        return this.steps[this.currentIndex];
    }

    // -------------------------
    // Input Layer
    // -------------------------
    ingest(signal: Signal) {
        this.store.push(signal);

        if (signal.mode === "event") {
            this.handleEvent(signal);
        }

        if (signal.mode === "fact") {
            this.recompute();
        }
    }

    handleEvent(signal: Signal) {
        const step = this.currentStep;

        if (!step) return;

        if (
            signal.key === step.complete &&
            signal.timestamp >= (step.activatedAt ?? 0)
        ) {
            this.currentIndex++;
            this.recompute();
        }
    }

    // -------------------------
    // Core deterministic compute
    // -------------------------
    recompute() {
        const prev = this.currentIndex;

        const next = FlowResolver.resolve(
            this.steps,
            this.store,
            this.currentIndex
        );

        const safe = Math.max(
            0,
            Math.min(next, this.steps.length - 1)
        );

        this.currentIndex = safe;

        if (prev !== safe) {
            this.activateStep();
        }
    }

    // -------------------------
    // PURE activation (no Date.now)
    // -------------------------
    activateStep() {
        const step = this.currentStep;
        if (!step) return;

        step.activatedAt ??= this.store.lastTimestamp();
    }

    // -------------------------
    // revert
    // -------------------------
    revert(index: number) {
        this.currentIndex = index;
        this.recompute();
    }
}

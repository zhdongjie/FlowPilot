// src/sdk/core/engine.ts

import {SignalStore} from "./store";
import {FlowResolver} from "./resolver";
import type {Step} from "../types/step";
import type {Signal} from "../types/signal";

export class FlowEngine {
    steps: Step[];
    currentIndex = 0;
    store = new SignalStore();

    constructor(steps: Step[]) {
        this.steps = steps;
        this.bootstrap();
    }

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

        if (
            signal.key === step.complete &&
            signal.timestamp >= (step.activatedAt ?? 0)
        ) {
            this.currentIndex++;
            this.recompute();
        }
    }

    recompute() {
        const prev = this.currentIndex;

        const nextIndex = FlowResolver.resolve(
            this.steps,
            this.store,
            this.currentIndex
        );

        const safeIndex = Math.max(
            0,
            Math.min(nextIndex, this.steps.length - 1)
        );

        this.currentIndex = safeIndex;

        if (prev !== safeIndex) {
            this.activateStep();
        }
    }

    activateStep() {
        const step = this.currentStep;

        if (!step) return;

        step.activatedAt = Date.now();
    }

    revert(index: number) {
        this.currentIndex = index;
        this.recompute();
    }


}

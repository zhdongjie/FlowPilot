import { SignalStore } from "./store";
import type { Step } from "../types/step";
import type { Signal } from "../types/signal";

export class FlowEngine {
    steps: Step[];
    private store = new SignalStore();

    private state = {
        currentIndex: 0
    };

    constructor(steps: Step[]) {
        this.steps = steps;
        this.state.currentIndex = 0;
    }

    // -------------------------
    // PUBLIC
    // -------------------------
    get currentStep(): Step | undefined {
        return this.steps[this.state.currentIndex];
    }

    get currentIndex() {
        return this.state.currentIndex;
    }

    getEvents() {
        return this.store.getEvents();
    }

    // -------------------------
    // INGEST (唯一入口)
    // -------------------------
    ingest(signal: Signal) {
        this.store.push(signal);

        // 只做一步推进（关键修复点）
        this.tryAdvance(signal);
    }

    // -------------------------
    // CORE TRANSITION (FIXED)
    // -------------------------
    private tryAdvance(signal: Signal) {
        const step = this.currentStep;
        if (!step) return;

        if (this.matches(signal, step)) {
            this.state.currentIndex++;
        }
    }

    // -------------------------
    // RECOMPUTE (PURE)
    // -------------------------
    recompute() {
        this.state.currentIndex = 0;

        const events = this.store.getEvents();

        for (const e of events) {
            const step = this.currentStep;
            if (!step) break;

            if (this.matches(e, step)) {
                this.state.currentIndex++;
            }
        }
    }

    // -------------------------
    // REVERT (FIXED)
    // -------------------------
    revert(index: number) {
        const safeIndex = Math.max(0, Math.min(index, this.steps.length));

        this.state.currentIndex = 0;
        const events = this.store.getEvents();

        // replay only up to index
        for (const e of events) {
            const step = this.currentStep;
            if (!step) break;

            if (this.matches(e, step)) {
                this.state.currentIndex++;
            }

            if (this.state.currentIndex >= safeIndex) {
                break;
            }
        }
    }

    // -------------------------
    // MATCH RULE
    // -------------------------
    private matches(signal: Signal, step: Step): boolean {
        return signal.key === step.id;
    }
}

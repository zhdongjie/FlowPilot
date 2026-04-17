// src/sdk/core/engine.ts

import {SignalStore} from "./store";
import {Projection} from "./projection";
import type {Step} from "../types/step";
import type {Signal} from "../types/signal";

export class FlowEngine {
    steps: Step[];
    private store = new SignalStore();

    private state = {
        currentIndex: 0
    };

    constructor(steps: Step[]) {
        this.steps = steps;
        this.resetState();
    }

    private resetState() {
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
    // INGEST
    // -------------------------
    ingest(signal: Signal) {
        this.store.push(signal);
        this.tryAdvance(signal);
    }

    // -------------------------
    // CORE TRANSITION (纯 FSM 模式)
    // -------------------------
    private tryAdvance(signal: Signal) {
        const step = this.currentStep;
        if (!step) return;

        // 👉 核心修复：纯语义匹配，不再进行严格的时间校验
        if (signal.key === step.complete) {
            this.advance();
        }
    }

    private advance() {
        // 防止指针溢出
        if (this.state.currentIndex >= this.steps.length - 1) {
            return;
        }

        this.state.currentIndex++;
        const nextStep = this.currentStep;

        if (nextStep) {
            if (Projection.hasFact(this.store.getEvents(), nextStep.complete)) {
                this.advance();
            }
        }
    }

    // -------------------------
    // RECOMPUTE & REVERT
    // -------------------------
    recompute() {
        this.resetState();

        const events = this.store.getEvents();

        const sorted = [...events].sort((a, b) => {
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        });

        for (const e of sorted) {
            this.tryAdvance(e);
        }
    }

    revert(index: number) {
        const safeIndex = Math.max(0, Math.min(index, this.steps.length - 1));

        const events = [...this.store.getEvents()];

        const truncated = this.truncateEventsForStep(events, safeIndex);

        this.store.clear();
        truncated.forEach((e: Signal) => this.store.push(e));

        this.recompute();
    }

    private truncateEventsForStep(events: Signal[], targetStep: number): Signal[] {
        const result: Signal[] = [];
        let stepIndex = 0;

        for (const e of events) {
            result.push(e);

            const step = this.steps[stepIndex];
            if (step && e.key === step.complete) {
                stepIndex++;
            }

            if (stepIndex >= targetStep) {
                break;
            }
        }

        return result;
    }
}

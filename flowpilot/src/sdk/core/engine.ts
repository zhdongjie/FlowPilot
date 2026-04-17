// src/sdk/core/engine.ts

import { SignalStore } from "./store";
import type { Step, Condition, Signal } from "../types";

export class FlowEngine {
    private readonly store = new SignalStore();
    private readonly stepsMap: Map<string, Step> = new Map();

    private readonly factMap = new Map<string, number>();

    private readonly activeSteps = new Set<string>();
    private readonly completedSteps = new Set<string>();
    private readonly rootStepId: string;

    constructor(steps: Step[], rootStepId: string) {
        steps.forEach(s => this.stepsMap.set(s.id, s));
        this.rootStepId = rootStepId;
        this.resetState();
    }

    private resetState() {
        this.activeSteps.clear();
        this.completedSteps.clear();
        this.factMap.clear();
        if (this.rootStepId) {
            this.activeSteps.add(this.rootStepId);
        }
    }

    // -------------------------
    // PUBLIC & DEBUG
    // -------------------------
    inspect() {
        return {
            activeSteps: [...this.activeSteps],
            completedSteps: [...this.completedSteps],
            factMap: Object.fromEntries(this.factMap),
            eventCount: this.store.getEvents().length
        };
    }

    getActiveSteps() { return [...this.activeSteps]; }
    getCompletedSteps() { return [...this.completedSteps]; }

    // -------------------------
    // INGEST
    // -------------------------
    ingest(signal: Signal) {
        // 1. 存入 Store（内部已做幂等去重）
        this.store.push(signal);

        // 2. 更新 FactMap 投影索引
        this.updateFact(signal);

        // 3. 执行评估循环
        this.evaluateLoop();
    }

    private updateFact(signal: Signal) {
        const count = this.factMap.get(signal.key) || 0;
        this.factMap.set(signal.key, count + 1);
    }

    // -------------------------
    // CORE LOOP
    // -------------------------
    private evaluateLoop() {
        let changed = true;

        while (changed) {
            changed = false;
            for (const stepId of this.activeSteps) {
                const step = this.stepsMap.get(stepId);
                if (!step) continue;

                if (this.evaluate(step.when)) {
                    this.completedSteps.add(stepId);
                    this.activeSteps.delete(stepId);

                    step.next?.forEach(nextId => {
                        if (!this.completedSteps.has(nextId) && !this.activeSteps.has(nextId)) {
                            this.activeSteps.add(nextId);
                        }
                    });

                    changed = true;
                }
            }
        }
    }

    private evaluate(cond: Condition): boolean {
        if (!cond) return false;
        switch (cond.type) {
            case "event":
                return this.factMap.has(cond.key);
            case "and":
                return cond.conditions.every(c => this.evaluate(c));
            case "or":
                return cond.conditions.some(c => this.evaluate(c));
            default:
                return false;
        }
    }

    /**
     * recompute 不再调用含有 store.push 的 ingest 方法。
     */
    recompute() {
        const events = [...this.store.getEvents()];
        this.store.clear();
        this.replay(events);
    }

    private replay(events: Signal[]) {
        this.resetState();
        const sorted = [...events].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

        for (const e of sorted) {
            this.store.push(e);
            this.updateFact(e);
            this.evaluateLoop();
        }
    }

    revert(targetStepId: string) {
        const events = [...this.store.getEvents()];
        const newStoreEvents: Signal[] = [];

        const shadow = new FlowEngine([...this.stepsMap.values()], this.rootStepId);

        for (const e of events) {
            newStoreEvents.push(e);
            shadow.ingest(e);
            if (shadow.getCompletedSteps().includes(targetStepId)) break;
        }

        this.store.clear();
        newStoreEvents.forEach(e => this.store.push(e));
        this.recompute();
    }
}

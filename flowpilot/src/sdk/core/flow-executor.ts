// src/sdk/core/flow-executor.ts

import { FlowExecutorDeps, StatePatch } from "./flow-executor.types";
import { FlowState } from "./flow-state";

export class FlowExecutor {

    constructor(
        private readonly deps: FlowExecutorDeps
    ) {

    }

    // 🟢 阶段 1：处理 Pending -> Active 的跃迁
    processPendingSteps(state: FlowState, ts: number): StatePatch {
        const patch: StatePatch = {
            pending: [],
            activate: [],
            complete: [],
            cancel: [],
            timers: [],
            traces: []
        };

        const steps = [...state.pendingSteps]
        for (const stepId of steps) {
            const step = this.stepsMap.get(stepId);
            if (!step) continue;

            const ctx = this.deps.createContext(stepId, ts);

            if (!step.compiledEnterWhen || step.compiledEnterWhen(ctx)) {
                patch.activate.push(stepId);

                patch.traces.push({
                    id: crypto.randomUUID(),
                    type: "STEP_ACTIVATE",
                    timestamp: ts,
                    stepId
                });
            }
        }

        return patch;
    }

    // 🔵 阶段 2：处理 Active -> Cancelled / Completed 的跃迁
    processActiveSteps(state: FlowState, ts: number): StatePatch {
        const patch: StatePatch = {
            pending: [],
            activate: [],
            complete: [],
            cancel: [],
            timers: [],
            traces: []
        };

        const steps = [...state.activeSteps]
        for (const stepId of steps) {
            const step = this.stepsMap.get(stepId);
            if (!step) continue;

            const ctx = this.deps.createContext(stepId, ts);

            // -------------------------
            // cancel 优先
            // -------------------------
            if (step.compiledCancelWhen?.(ctx)) {
                patch.cancel.push(stepId);

                patch.traces.push({
                    id: crypto.randomUUID(),
                    type: "STEP_CANCEL",
                    timestamp: ts,
                    stepId,
                    meta: {
                        reason: "CANCELLED_BY_CONDITION"
                    }
                });
                for (const nextId of step.next ?? []) {
                    const isUntouched =
                        !state.completedSteps.has(nextId) &&
                        !state.activeSteps.has(nextId) &&
                        !state.pendingSteps.has(nextId) &&
                        !state.cancelledSteps.has(nextId);

                    if (isUntouched) {
                        patch.pending.push(nextId);
                    }
                }

                continue;
            }

            // -------------------------
            // complete
            // -------------------------
            if (step.compiledWhen?.(ctx)) {
                patch.complete.push(stepId);

                patch.traces.push({
                    id: crypto.randomUUID(),
                    type: "STEP_COMPLETE",
                    timestamp: ts,
                    stepId,
                    meta: {
                        toStep: step.next?.join(",")
                    }
                });

                // next step → activate（唯一扩散入口）
                for (const nextId of step.next ?? []) {
                    const isUntouched =
                        !state.completedSteps.has(nextId) &&
                        !state.activeSteps.has(nextId) &&
                        !state.pendingSteps.has(nextId) &&
                        !state.cancelledSteps.has(nextId);

                    if (isUntouched) {
                        patch.pending.push(nextId);
                    }
                }
            }
        }

        return patch;
    }

    private get stepsMap() {
        return this.deps.stepsMap;
    }

}

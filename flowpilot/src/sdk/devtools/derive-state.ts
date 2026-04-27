// src/sdk/devtools/derive-state.ts

import type { TraceEvent } from "../runtime/trace";

export function deriveState(events: TraceEvent[]) {
    const active = new Set<string>();
    const completed = new Set<string>();
    const pending = new Set<string>();
    const cancelled = new Set<string>(); // 增加取消集合，防止被错误地重新推入 pending

    for (const e of events) {
        switch (e.type) {
            case "ENGINE_INIT":
                // 🌟 起点：引擎初始化时，根节点进入 pending
                if (e.meta?.rootStepId) {
                    pending.add(e.meta.rootStepId);
                }
                break;

            case "STEP_ACTIVATE":
                if (e.stepId) {
                    active.add(e.stepId);
                    // 🌟 跃迁：激活后，必定离开 pending 状态
                    pending.delete(e.stepId);
                }
                break;

            case "STEP_COMPLETE":
                if (e.stepId) {
                    active.delete(e.stepId);
                    pending.delete(e.stepId); // 防御性清理（比如被 forceComplete）
                    completed.add(e.stepId);

                    // 🌟 扩散：上一个节点完成，释放它的下游节点进入 pending
                    if (e.meta?.toStep) {
                        // 兼容 toStep 是字符串 "step_a,step_b" 或数组的情况
                        const nextSteps = typeof e.meta.toStep === 'string'
                            ? e.meta.toStep.split(',')
                            : e.meta.toStep;

                        nextSteps.forEach((nextId: string) => {
                            if (!nextId) return;

                            // 只有没被碰过的节点，才有资格进入 pending
                            const isUntouched =
                                !completed.has(nextId) &&
                                !active.has(nextId) &&
                                !cancelled.has(nextId);

                            if (isUntouched) {
                                pending.add(nextId);
                            }
                        });
                    }
                }
                break;

            case "STEP_CANCEL":
                if (e.stepId) {
                    active.delete(e.stepId);
                    pending.delete(e.stepId);
                    cancelled.add(e.stepId);
                }
                break;

            default:
                break;
        }
    }

    return {
        active: [...active],
        completed: [...completed],
        pending: [...pending],
    };
}

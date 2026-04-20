// src/sdk/compiler/condition.ts

import type { Condition, EventCondition, SequenceCondition, NotCondition } from "../types";
import type { CompiledCondition, EvalContext } from "../types/runtime";

export class ConditionCompiler {

    /**
     * 将 AST 节点递归编译为 O(1) 执行的闭包函数
     */
    static compile(cond: Condition): CompiledCondition {
        switch (cond.type) {
            case "event":
                return this.compileEvent(cond);
            case "sequence":
                return this.compileSequence(cond);
            case "after":
                return (ctx) => ctx.completedSteps.has(cond.stepId);
            case "not":
                return this.compileNot(cond);
            case "and": {
                const children = cond.conditions.map(c => this.compile(c));
                return (ctx) => {
                    // 短路求值：任何一个失败则整体失败
                    for (const fn of children) {
                        if (!fn(ctx)) return false;
                    }
                    return true;
                };
            }
            case "or": {
                const children = cond.conditions.map(c => this.compile(c));
                return (ctx) => {
                    // 短路求值：任何一个成功则整体成功
                    for (const fn of children) {
                        if (fn(ctx)) return true;
                    }
                    return false;
                };
            }
            default:
                return () => false;
        }
    }

    private static compileEvent(cond: EventCondition): CompiledCondition {
        return (ctx: EvalContext) => {
            if (!ctx.factMap.has(cond.key)) return false;

            const ref = cond.afterStep || ctx.currentStepId;
            const cutoff = ctx.activatedAt.get(ref) ?? 0;
            const list = ctx.eventIndex.get(cond.key);

            if (!list || list.length === 0) return false;

            const start = ctx.lowerBound(list, cutoff);
            if (start >= list.length) return false;

            const required = cond.count || 1;
            if (list.length - start < required) return false;

            if (cond.within) {
                if (required === 1) {
                    return list[start].ts - cutoff <= cond.within;
                }
                for (let i = start; i <= list.length - required; i++) {
                    const first = list[i].ts;
                    const last = list[i + required - 1].ts;
                    if (last - first <= cond.within) return true;
                }
                return false;
            }

            return true;
        };
    }

    private static compileSequence(cond: SequenceCondition): CompiledCondition {
        return (ctx: EvalContext) => {
            const ref = cond.afterStep || ctx.currentStepId;
            const cutoff = ctx.activatedAt.get(ref) ?? 0;
            let currentTs = cutoff;

            for (const key of cond.keys) {
                const list = ctx.eventIndex.get(key);
                if (!list) return false;

                const idx = ctx.lowerBound(list, currentTs);
                if (idx >= list.length) return false;

                const ts = list[idx].ts;
                if (cond.within && ts - cutoff > cond.within) return false;

                currentTs = ts + 1;
            }
            return true;
        };
    }

    private static compileNot(cond: NotCondition): CompiledCondition {
        const inner = this.compile(cond.condition);

        return (ctx: EvalContext) => {
            const c = cond.condition;

            // 🔥 V2 核心：有界时间缺席 (Bounded Absence)
            if (c.type === "event" && c.within) {
                const ref = c.afterStep || ctx.currentStepId;
                const cutoff = ctx.activatedAt.get(ref) ?? 0;

                const happened = inner(ctx);
                // 只要在窗口内发生过，NOT 直接判定失败
                if (happened) return false;

                // 如果没发生，且时间已经越过了窗口，NOT 判定成功！
                return ctx.currentEventTs - cutoff > c.within;
            }

            // 瞬时否定
            return !inner(ctx);
        };
    }
}

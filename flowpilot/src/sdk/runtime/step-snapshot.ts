import type { Step } from "../types";

function cloneConditionValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(item => cloneConditionValue(item)) as T;
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    if (value instanceof Date) {
        return new Date(value.getTime()) as T;
    }

    const cloned: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        cloned[key] = typeof item === "function"
            ? item
            : cloneConditionValue(item);
    }

    return cloned as T;
}

export function cloneStepSnapshot(
    step: Pick<Step, "id" | "when" | "next" | "enterWhen" | "cancelWhen">
): Step {
    return {
        id: step.id,
        when: cloneConditionValue(step.when),
        next: step.next ? [...step.next] : undefined,
        enterWhen: step.enterWhen
            ? cloneConditionValue(step.enterWhen)
            : undefined,
        cancelWhen: step.cancelWhen
            ? cloneConditionValue(step.cancelWhen)
            : undefined
    };
}

export function cloneStepSnapshots(steps: Step[]): Step[] {
    return steps.map(step => cloneStepSnapshot(step));
}

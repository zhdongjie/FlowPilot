// src/sdk/core/flow-state.ts

export class FlowState {
    activeSteps = new Set<string>();
    pendingSteps = new Set<string>();
    completedSteps = new Set<string>();
    cancelledSteps = new Set<string>();

    activatedAt = new Map<string, number>();
    completedAt = new Map<string, number>();
}

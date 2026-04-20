// src/sdk/guide/scheduler.ts

export class StepScheduler {
    /**
     * 策略：目前简单取第一个活跃步骤，未来可扩展优先级权重
     */
    pick(activeSteps: string[]): string | null {
        return activeSteps.length > 0 ? activeSteps[0] : null;
    }
}

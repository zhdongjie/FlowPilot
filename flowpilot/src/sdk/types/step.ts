// src/sdk/types/step.ts
export interface Step {
    id: string;

    /**
     * 完成条件（Signal key）
     */
    complete: string;

    /**
     * Step 被激活时间（用于时间隔离）
     */
    activatedAt?: number;
}

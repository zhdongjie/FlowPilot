// src/sdk/types/step.ts

export interface Step {
    id: string;

    /**
     * 完成条件（Signal key）
     */
    complete: string;
}

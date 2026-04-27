// src/sdk/types/guide.ts

import type { FlowConfigOverride } from "./config";
import type { Step } from "./step";

export interface GuideStepUI {
    selector: string;     // 要高亮的 DOM 选择器
    content: string;      // 引导气泡的内容
    title?: string;       // 气泡标题
    position?: 'top' | 'bottom' | 'left' | 'right'; // 气泡位置
    nextLabel?: string | boolean;
}

export interface GuideStep extends Step {
    ui?: GuideStepUI;
}

export interface GuideDefinition {
    id: string;
    rootStepId: string;
    steps: GuideStep[];
    config?: FlowConfigOverride;
}

export type GuideDefinitionLoader =
    () => GuideDefinition | Promise<GuideDefinition>;

export type GuideSource =
    | GuideDefinition
    | Promise<GuideDefinition>
    | GuideDefinitionLoader;

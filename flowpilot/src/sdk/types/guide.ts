// src/sdk/types/guide.ts

import type { Step } from "./step";

export interface GuideStepUI {
    selector: string;     // 要高亮的 DOM 选择器
    content: string;      // 引导气泡的内容
    title?: string;       // 气泡标题
    position?: 'top' | 'bottom' | 'left' | 'right'; // 气泡位置
    nextLabel?: string;
}

export interface GuideStep extends Step {
    ui?: GuideStepUI;
}

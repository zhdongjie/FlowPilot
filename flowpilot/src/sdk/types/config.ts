// src/sdk/types/config.ts
import type { NetworkAdapter } from "./collector";

export interface FlowConfig {
    // 1. 插件配置
    adapters?: NetworkAdapter[];

    // 2. UI 默认表现
    ui: {
        defaultPosition: 'top' | 'bottom' | 'left' | 'right';
        defaultNextLabel?: string;
        themeColor: string;
    };

    // 3. 运行调度配置
    runtime: {
        pollingInterval: number; // DOM 检查频率
        waitForTimeout: number;  // 元素出现等待超时
        autoStart: boolean;      // 是否自动发送 start 信号
    };
}

export const DEFAULT_CONFIG: FlowConfig = {
    adapters: [],
    ui: {
        defaultPosition: 'bottom',
        themeColor: '#007aff',
        defaultNextLabel: '我知道了'
    },
    runtime: {
        pollingInterval: 50,
        waitForTimeout: 3000,
        autoStart: true
    }
};

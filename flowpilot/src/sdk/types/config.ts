// src/sdk/types/config.ts
import type { NetworkAdapter } from "./collector";

export interface FlowConfig {
    adapters?: NetworkAdapter[];

    // 1. 视觉主题配置
    theme: {
        primaryColor: string;    // 按钮和高亮主色
        maskColor: string;       // 遮罩层颜色
        textColor: string;       // 文本颜色
        borderRadius: string;    // 气泡圆角
        zIndex: number;          // 层级
    };

    // 2. UI 默认行为
    ui: {
        defaultPosition: 'top' | 'bottom' | 'left' | 'right';
        defaultNextLabel: string;
    };

    // 3. 运行控制与持久化
    runtime: {
        pollingInterval: number;
        autoStart: boolean;
        persistence: {
            enabled: boolean;
            key: string;         // localStorage 的键名
        };
        // DOM 信号前缀映射表
        signalPrefix: {
            click: string;
            focus: string;
            blur: string;
            input: string;
        };
        attributeName: string;
    };

    // 4. 生命周期钩子 (用于业务埋点或联动)
    hooks: {
        onStepStart?: (stepId: string) => void;
        onStepComplete?: (stepId: string) => void;
        onFlowComplete?: () => void;
    };

    debug: boolean; // 是否开启控制台日志
}

export const DEFAULT_CONFIG: FlowConfig = {
    theme: {
        primaryColor: "#007aff",
        maskColor: "rgba(0,0,0,0.6)",
        textColor: "#333",
        borderRadius: "8px",
        zIndex: 9999
    },
    ui: {
        defaultPosition: "bottom",
        defaultNextLabel: "下一步"
    },
    runtime: {
        pollingInterval: 50,
        autoStart: true,
        persistence: {
            enabled: true,
            key: "flowpilot_finished"
        },
        signalPrefix: {
            click: 'click_',
            focus: 'focus_',
            blur: 'blur_',
            input: 'input_'
        },
        attributeName: 'data-fp'
    },
    hooks: {},
    debug: false
};

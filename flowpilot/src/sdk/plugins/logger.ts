// src/sdk/plugins/logger.ts
import type { Signal, FlowPlugin, FlowPluginContext } from "../types";

export interface LoggerPluginOptions {
    /** 日志前缀 */
    prefix?: string;
    /** 是否过滤高频 DOM 噪音 (focus/blur/input) */
    ignoreNoise?: boolean;
    /** 是否打印步骤耗时 */
    showTiming?: boolean;
}

export function LoggerPlugin(options: LoggerPluginOptions = {}): FlowPlugin {
    const {
        prefix = "FlowPilot",
        ignoreNoise = true,
        showTiming = true
    } = options;

    // 用于记录步骤启动时间，计算耗时
    const stepTimers = new Map<string, number>();

    // 🎨 定义控制台日志的主题样式
    const styles = {
        badge: `background: #333; color: #fff; border-radius: 4px; padding: 2px 6px; font-weight: bold; font-size: 10px;`,
        start: `color: #007aff; font-weight: bold;`,
        success: `color: #28a745; font-weight: bold;`,
        signal: `color: #f39c12; font-weight: bold;`,
        time: `color: #666; font-style: italic; font-size: 11px;`,
        noise: `color: #999; font-style: italic;`
    };

    const log = (style: string, icon: string, message: string, extra: string = '') => {
        if (extra) {
            console.log(`%c${prefix}%c ${icon} %c${message} %c${extra}`, styles.badge, '', style, styles.time);
        } else {
            console.log(`%c${prefix}%c ${icon} %c${message}`, styles.badge, '', style);
        }
    };

    return {
        name: "fp-logger",
        priority: 0,

        onStart(ctx: FlowPluginContext) {
            const state = ctx.getState();
            if (state.completedSteps.length > 0) {
                log(styles.start, "🚀", "引擎启动 (热恢复)", `已通关 [${state.completedSteps.join(', ')}]`);
            } else {
                log(styles.start, "🚀", "引擎启动 (冷启动)");
            }
        },

        onStepStart(stepId: string, ctx: FlowPluginContext) {
            if (showTiming) {
                stepTimers.set(stepId, ctx.now());
            }
            log(styles.start, "🟢", `激活节点: ${stepId}`);
        },

        onStepComplete(stepId: string, ctx: FlowPluginContext) {
            let timeMsg = "";
            if (showTiming && stepTimers.has(stepId)) {
                const cost = ctx.now() - stepTimers.get(stepId)!;
                timeMsg = `(+${cost}ms)`;
                stepTimers.delete(stepId);
            }
            log(styles.success, "✅", `完成节点: ${stepId}`, timeMsg);
        },

        onSignal(signal: Signal) {
            const isNoise = signal.key.startsWith('focus_') ||
                signal.key.startsWith('blur_') ||
                signal.key.startsWith('input_');

            if (isNoise) {
                if (!ignoreNoise) {
                    console.log(`%c${prefix} 〰️ 噪音信号: ${signal.key}`, styles.noise);
                }
                return;
            }

            log(styles.signal, "📡", `捕获信号: ${signal.key}`);
        },

        onStop() {
            log(styles.noise, "🛑", "引擎已停止");
            stepTimers.clear();
        }
    };
}

// src/sdk/plugins/logger.ts

import type { FlowPlugin } from "../types";

export function LoggerPlugin(): FlowPlugin {
    return {
        name: "fp-logger",
        onSignal(signal) {
            console.log(`📡 [Signal] ${signal.key} @ ${signal.timestamp}`);
        },
        onRender(ctx) {
            const state = ctx.getState();
            console.log(`🔄 [State] Active: ${state.activeSteps.join(',')}`);
        }
    };
}

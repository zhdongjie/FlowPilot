// src/sdk/guide/factory.ts

import { GuideController } from "./controller";
import { FlowConfig, FlowPlugin, GuideStep } from "../types";

export interface FlowPilotOptions {
    steps: GuideStep[];
    rootStepId: string;
    config?: Partial<FlowConfig>;
    plugins?: FlowPlugin[];
}

export function createFlowPilot(options: FlowPilotOptions) {
    return new GuideController({
        steps: options.steps,
        rootStepId: options.rootStepId,
        config: options.config,
        plugins: options.plugins
    });
}

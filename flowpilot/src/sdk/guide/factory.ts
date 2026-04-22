import { GuideController } from "./controller";

export interface FlowGuideOptions {
    steps: any[];
    rootStepId: string;
    adapters?: any[];
    theme?: any;
    ui?: any;
    runtime?: any;
    hooks?: any;
    debug?: boolean;
}

export function createFlowGuide(options: FlowGuideOptions) {
    const guide = new GuideController({
        steps: options.steps,
        rootStepId: options.rootStepId,
        config: {
            adapters: options.adapters,
            theme: options.theme,
            ui: options.ui,
            runtime: options.runtime,
            hooks: options.hooks,
            debug: options.debug
        }
    });

    guide.start();

    return guide;
}

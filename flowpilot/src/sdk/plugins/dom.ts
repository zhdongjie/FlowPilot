// src/sdk/plugins/dom.ts

import type { FlowPlugin, FlowPluginContext, Signal } from "../types";

export function DOMPlugin(): FlowPlugin {
    let handler: ((e: Event) => void) | null = null;

    return {
        name: "fx-dom-plugin",
        priority: 5,

        setup(ctx: FlowPluginContext) {
            const config = ctx.config.runtime;

            handler = (e: Event) => {
                let el = e.target as HTMLElement | null;

                while (el && el !== document.body) {
                    const key = el.getAttribute(config.attributeName);

                    if (key) {
                        let prefix = config.signalPrefix.click;

                        if (e.type === "focusin") prefix = config.signalPrefix.focus;
                        if (e.type === "focusout") prefix = config.signalPrefix.blur;
                        if (e.type === "input") prefix = config.signalPrefix.input;

                        const signal: Signal = {
                            id: `sig_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                            key: `${prefix}${key}`,
                            timestamp: Date.now(),
                            meta: {
                                tagName: el.tagName,
                                value: (el as HTMLInputElement).value
                            }
                        };

                        ctx.dispatch(signal);
                        return;
                    }

                    el = el.parentElement;
                }
            };

            document.addEventListener("click", handler, true);
            document.addEventListener("focusin", handler, true);
            document.addEventListener("focusout", handler, true);
            document.addEventListener("input", handler, true);
        },

        onDispose() {
            if (!handler) return;

            document.removeEventListener("click", handler, true);
            document.removeEventListener("focusin", handler, true);
            document.removeEventListener("focusout", handler, true);
            document.removeEventListener("input", handler, true);

            handler = null;
        }
    };
}

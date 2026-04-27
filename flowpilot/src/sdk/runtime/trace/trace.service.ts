// src/sdk/runtime/trace/trace.service.ts

import { TraceStore } from "./trace.store";
import { TraceScope, TraceMode } from "./trace.scope";

export class TraceService {

    static createScope(mode: TraceMode) {
        return new TraceScope(mode, new TraceStore());
    }

}

import { EventEmitter } from "events";
class TypedEventBus {
    emitter = new EventEmitter();
    constructor() {
        this.emitter.setMaxListeners(50);
    }
    emit(event, ...args) {
        this.emitter.emit(event, ...args);
    }
    on(event, handler) {
        this.emitter.on(event, handler);
    }
    off(event, handler) {
        this.emitter.off(event, handler);
    }
    removeAllListeners() {
        this.emitter.removeAllListeners();
    }
}
export const bus = new TypedEventBus();
//# sourceMappingURL=events.js.map
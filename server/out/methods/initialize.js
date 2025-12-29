"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = void 0;
const log_1 = require("../log");
const initialize = (message) => {
    log_1.default.write("Inside Initialization!");
    return {
        capabilities: { completionProvider: {}, textDocumentSync: 1, hoverProvider: true },
        serverInfo: {
            name: "mcstas_language_server",
            version: "0.0.1"
        }
    };
};
exports.initialize = initialize;
//# sourceMappingURL=initialize.js.map
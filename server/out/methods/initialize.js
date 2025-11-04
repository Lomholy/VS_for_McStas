"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = void 0;
const log_1 = require("../log");
async function printcomponents(url) {
    try {
        const response = await fetch(url);
        const text = await response.text(); // or use response.json() if it's JSON
        log_1.default.write(text); // Now logs the actual response content
    }
    catch (error) {
        log_1.default.write(`Error fetching from Flask server: ${error}`);
    }
}
async function waitForServerReady(url, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const res = await fetch(url);
            const text = await res.text();
            log_1.default.write(text);
            if (res.ok)
                return;
        }
        catch (_) {
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    log_1.default.write('Error: server not reachable');
    throw new Error("Server did not start in time");
}
const initialize = (message) => {
    log_1.default.write("Inside Initialization!");
    // const mccodePath = path.join(__dirname, '../../', 'McCode/mcstas-comps')
    (async () => {
        try {
            await waitForServerReady('http://127.0.0.1:5000/');
            await printcomponents('http://127.0.0.1:5000/get_all_comps');
        }
        catch (error) {
            log_1.default.write(`Error waiting for server: ${error}`);
        }
    })();
    return {
        capabilities: { completionProvider: {}, textDocumentSync: 1 },
        serverInfo: {
            name: "lsp-from-scratch",
            version: "0.0.1"
        }
    };
};
exports.initialize = initialize;
//# sourceMappingURL=initialize.js.map
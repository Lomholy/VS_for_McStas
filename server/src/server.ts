import log from "./log";
import { initialize } from "./methods/initialize";
import { completion } from "./methods/textDocument/completion";
import { didChange } from "./methods/textDocument/didChange";
import { hover } from "./methods/textDocument/hover";

interface Message { jsonrpc: string }
export interface NotificationMessage extends Message { method: string; params?: unknown[] | object; }
export interface RequestMessage extends NotificationMessage { id: number | string }

type RequestMethod =
  (message: RequestMessage) =>
    ReturnType<typeof initialize> |
    ReturnType<typeof completion> |
    ReturnType<typeof hover>;

type NotificationMethod = (message: NotificationMessage) => void;

const methodLookup: Record<string, RequestMethod | NotificationMethod> = {
  initialize,
  "textDocument/completion": completion,
  "textDocument/didChange": didChange,
  "textDocument/hover": hover
};

/** Send a JSON-RPC 2.0 response (only for requests). */
function respond(id: RequestMessage['id'], result: object | null) {
  const payload = JSON.stringify({ jsonrpc: "2.0", id, result });
  const header = `Content-Length: ${Buffer.byteLength(payload, "utf-8")}\r\n\r\n`;
  process.stdout.write(header);
  process.stdout.write(payload);
}

/** Accumulate raw bytes (NOT a string!) because Content-Length counts bytes. */
let buffer: Buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk: Buffer) => {
  // Append new bytes
  buffer = Buffer.concat([buffer, chunk]);

  // Process as many complete messages as are in the buffer
  while (true) {
    // 1) Find end of the header block
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break; // need more data for complete headers

    // 2) Parse headers from the header block only (ASCII per spec)
    const headerText = buffer.slice(0, headerEnd).toString("ascii");
    const lengthMatch = headerText.match(/^Content-Length:\s*(\d+)\s*$/mi);
    if (!lengthMatch) {
      // Protocol violation: no Content-Length → drop headers and continue
      log.write({ error: "Missing Content-Length", headerText });
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(lengthMatch[1], 10);
    const messageStart = headerEnd + 4; // skip \r\n\r\n
    const messageEnd = messageStart + contentLength;

    if (buffer.length < messageEnd) break; // wait for more bytes

    // 3) Extract the UTF-8 JSON body bytes exactly and decode
    const bodyBytes = buffer.slice(messageStart, messageEnd);
    const rawMessage = bodyBytes.toString("utf8");

    // 4) Advance the buffer before handling (prevents reentrancy issues)
    buffer = buffer.slice(messageEnd);

    // 5) Safe parse + dispatch
    try {
      const message = JSON.parse(rawMessage) as Partial<RequestMessage & NotificationMessage>;

      // Minimal sanity: ensure jsonrpc and method exist for requests/notifications
      if (message && typeof message === "object" && typeof message.method === "string") {
        const method = methodLookup[message.method];
        if (method) {
          // Call handler. If it returns a value (or Promise resolving to value),
          // and the message has an id, we must send a JSON-RPC response.
          const maybePromise = (method as any)(message);

          // Support both sync and async handlers
          Promise.resolve(maybePromise)
            .then((result) => {
              // Only respond to *requests* (those have an id)
              if (message.hasOwnProperty("id")) {
                respond((message as RequestMessage).id, result ?? null);
              }
            })
            .catch((err) => {
              log.write({ handlerError: String(err), method: message.method });
              // Optionally: send a JSON-RPC error response here
              if (message.hasOwnProperty("id")) {
                const errorPayload = {
                  jsonrpc: "2.0",
                  id: (message as RequestMessage).id,
                  error: { code: -32603, message: "Internal error" }
                };
                const body = JSON.stringify(errorPayload);
                const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
                process.stdout.write(header + body);
              }
            });
        } else {
          // Unknown method: if it's a request with id, reply Method Not Found
          if (message.hasOwnProperty("id")) {
            const errorPayload = {
              jsonrpc: "2.0",
              id: (message as RequestMessage).id,
              error: { code: -32601, message: `Method not found: ${message.method}` }
            };
            const body = JSON.stringify(errorPayload);
            const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
            process.stdout.write(header + body);
          }
        }
      } else {
        // It might be a response or a $/notification from client; ignore for now.
        // You can add handling here if you use client notifications.
      }
    } catch (e) {
      log.write({ parseError: String(e), rawPreview: rawMessage.slice(0, 200) });
      // If parsing fails, continue with next message (buffer is already advanced)
    }
  }
});

process.stdin.on("error", (err) => log.write({ stdinError: String(err) }));
process.on("uncaughtException", (err) => log.write({ uncaughtException: String(err) }));
process.on("unhandledRejection", (reason) => log.write({ unhandledRejection: String(reason) }));
``
"""Manual smoke test: start the server, open a small in-memory document, and
exercise hover and completion against it over stdio -- the same wire format
`server.ts` implements by hand.

Usage (after `pip install -e ".[dev]"` from server/python):

    python3 scripts/smoke_test_hover_completion.py
"""

from __future__ import annotations

import json
import subprocess
import sys

DOC_TEXT = "COMPONENT src = Arm(\n)\nAT (0,0,0) RELATIVE PREVIOUS\n"


def frame(payload: dict) -> bytes:
    body = json.dumps(payload).encode("utf-8")
    header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    return header + body


def read_message(stream) -> dict:
    headers = {}
    while True:
        line = stream.readline().decode("ascii")
        if line in ("\r\n", "\n", ""):
            break
        name, _, value = line.partition(":")
        headers[name.strip().lower()] = value.strip()
    length = int(headers["content-length"])
    body = stream.read(length)
    return json.loads(body.decode("utf-8"))


def send(proc: subprocess.Popen, payload: dict) -> None:
    proc.stdin.write(frame(payload))
    proc.stdin.flush()


def main() -> None:
    # stderr must not be captured into an unread PIPE here: pygls logs
    # verbosely, and an unread pipe fills up and deadlocks the child.
    proc = subprocess.Popen(
        [sys.executable, "-m", "mcstas_ls.server"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )

    send(proc, {
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"processId": None, "rootUri": None, "capabilities": {}},
    })
    read_message(proc.stdout)

    send(proc, {"jsonrpc": "2.0", "method": "initialized", "params": {}})

    send(proc, {
        "jsonrpc": "2.0",
        "method": "textDocument/didOpen",
        "params": {
            "textDocument": {
                "uri": "file:///tmp/smoke_test.instr",
                "languageId": "mccode",
                "version": 1,
                "text": DOC_TEXT,
            }
        },
    })

    # Hover over "Arm" on line 0.
    send(proc, {
        "jsonrpc": "2.0", "id": 2, "method": "textDocument/hover",
        "params": {
            "textDocument": {"uri": "file:///tmp/smoke_test.instr"},
            "position": {"line": 0, "character": 17},
        },
    })
    hover_response = read_message(proc.stdout)
    print("hover response:")
    print(json.dumps(hover_response, indent=2))
    assert hover_response["result"]["contents"]["value"].startswith("## Arm"), "hover did not resolve Arm"

    # Completion on the blank line inside Arm's (empty) parameter list.
    send(proc, {
        "jsonrpc": "2.0", "id": 3, "method": "textDocument/completion",
        "params": {
            "textDocument": {"uri": "file:///tmp/smoke_test.instr"},
            "position": {"line": 1, "character": 0},
        },
    })
    completion_response = read_message(proc.stdout)
    items = completion_response.get("result", {}).get("items", [])
    print(f"\ncompletion response: {len(items)} items, first 5 labels:", [it["label"] for it in items[:5]])
    assert items, "completion returned no items"

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

    print("\nOK")


if __name__ == "__main__":
    main()

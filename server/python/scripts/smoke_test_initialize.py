"""Manual smoke test: start the server as a subprocess, send a framed LSP
`initialize` request over stdio, and print whatever comes back.

Usage (after `pip install -e ".[dev]"` from server/python):

    python3 scripts/smoke_test_initialize.py
"""

from __future__ import annotations

import json
import subprocess
import sys


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


def main() -> None:
    # stderr must not be captured into an unread PIPE here: pygls logs
    # verbosely, and an unread pipe fills up and deadlocks the child.
    proc = subprocess.Popen(
        [sys.executable, "-m", "mcstas_ls.server"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )

    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {"processId": None, "rootUri": None, "capabilities": {}},
    }
    proc.stdin.write(frame(request))
    proc.stdin.flush()

    response = read_message(proc.stdout)
    print(json.dumps(response, indent=2))

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


if __name__ == "__main__":
    main()

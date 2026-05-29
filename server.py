from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


HOST = "127.0.0.1"
PORT = int(os.environ.get("EV_API_TESTER_PORT", "8765"))


def app_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


class EnergyValveApiTester(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(app_root()), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_POST(self) -> None:
        if self.path == "/write":
            self.handle_write()
            return
        if self.path == "/read":
            self.handle_read()
            return
        self.write_json(404, {"success": False, "error": "Not found"})

    def handle_write(self) -> None:
        payload = self.read_json()
        ips = self.write_ips(payload)
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        endpoint = self.normalize_endpoint(str(payload.get("endpoint", "")).strip())
        value = str(payload.get("value", "")).strip()

        if not ips or not username or not password or not endpoint or not value:
            self.write_json(400, {"success": False, "error": "At least one IP, username, password, endpoint, and value are required"})
            return
        if any(self.invalid_ip(ip) for ip in ips) or any(char in endpoint for char in [" ", "\""]):
            self.write_json(400, {"success": False, "error": "Invalid IP or endpoint"})
            return

        results = [
            self.run_curl("PUT", ip, username, password, endpoint, data=f"{{'value':{value}}}")
            for ip in ips
        ]
        result = {"success": all(item["success"] for item in results), "targets": results}
        self.write_json(200 if result["success"] else 502, result)

    def handle_read(self) -> None:
        payload = self.read_json()
        ip = str(payload.get("ip", "")).strip()
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        endpoint = self.normalize_endpoint(str(payload.get("endpoint", "")).strip())

        if not ip or not username or not password or not endpoint:
            self.write_json(400, {"success": False, "error": "IP, username, password, and endpoint are required"})
            return
        if self.invalid_ip(ip) or any(char in endpoint for char in [" ", "\""]):
            self.write_json(400, {"success": False, "error": "Invalid IP or endpoint"})
            return

        result = self.run_curl("GET", ip, username, password, endpoint)
        self.write_json(200 if result["success"] else 502, result)

    def run_curl(self, method: str, ip: str, username: str, password: str, endpoint: str, data: str | None = None) -> dict:
        command = [
            "curl.exe",
            "--noproxy",
            "*",
            "--connect-timeout",
            "8",
            "--basic",
            "-X",
            method,
            "-k",
            f"https://{ip}:443{endpoint}",
            "-u",
            f"{username}:{password}",
        ]
        if data is not None:
            command.extend(["-d", data])

        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=20, check=False)
        except subprocess.TimeoutExpired:
            return {"success": False, "ip": ip, "error": "curl request timed out"}
        except OSError as exc:
            return {"success": False, "ip": ip, "error": f"Unable to run curl.exe: {exc}"}

        return {
            "success": result.returncode == 0,
            "ip": ip,
            "curlExitCode": result.returncode,
            "commandPreview": self.mask_password(command),
            "stdout": self.parse_stdout(result.stdout),
            "stderr": result.stderr.strip(),
        }

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def write_ips(self, payload: dict) -> list[str]:
        raw_ips = payload.get("ips")
        if isinstance(raw_ips, list):
            return [str(ip).strip() for ip in raw_ips if str(ip).strip()]
        ip = str(payload.get("ip", "")).strip()
        return [ip] if ip else []

    def normalize_endpoint(self, endpoint: str) -> str:
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            endpoint = urlparse(endpoint).path
        return endpoint if endpoint.startswith("/") else f"/{endpoint}"

    def invalid_ip(self, ip: str) -> bool:
        return any(char in ip for char in "/:@")

    def parse_stdout(self, stdout: str):
        stripped = stdout.strip()
        if not stripped:
            return ""
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return stripped

    def mask_password(self, command: list[str]) -> str:
        parts = []
        for part in command:
            if part.startswith("https://") and "@" in part:
                prefix, rest = part.split("://", 1)
                credentials, host = rest.split("@", 1)
                user = credentials.split(":", 1)[0]
                parts.append(f"{prefix}://{user}:********@{host}")
            else:
                parts.append(part)
        return " ".join(f'"{p}"' if " " in p else p for p in parts)

    def write_json(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def run_server() -> None:
    server = ThreadingHTTPServer((HOST, PORT), EnergyValveApiTester)
    print(f"EV API Tester running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()

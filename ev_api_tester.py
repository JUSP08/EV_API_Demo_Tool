from __future__ import annotations

import threading
import time
import webbrowser

from server import HOST, PORT, run_server


def main() -> None:
    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    url = f"http://{HOST}:{PORT}/"
    time.sleep(1)
    webbrowser.open(url)
    print(f"EV API Tester is running at {url}")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Лёгкий статик-сервер для прототипа + приёмка правок текста.

Отдаёт файлы из своей папки (как `python -m http.server`), но дополнительно
принимает правки RU и EN и пишет их в отдельные JSON рядом с HTML.
Это нужно, чтобы кнопка «Сохранить» во встроенном редакторе клала правки прямо
в репозиторий — без ручного скачивания и пересылки файлов.

Запуск: python3 serve.py [порт]   (по умолчанию 8000)
"""
import http.server
import json
import os
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
SAVE_FILES = {
    "/__save": os.path.join(DIR, "edits.json"),
    "/__save-en": os.path.join(DIR, "edits-en.json"),
    # решения Васи по правкам команды (review.html → team-review.js)
    "/__save-review": os.path.join(DIR, "review-decisions.json"),
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=DIR, **k)

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        save_file = SAVE_FILES.get(self.path.split("?")[0])
        if save_file is None:
            self._json(404, {"ok": False, "error": "not found"})
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(n)
            json.loads(data.decode("utf-8"))  # валидируем, что это корректный JSON
            with open(save_file, "wb") as f:
                f.write(data)
            self._json(200, {"ok": True, "saved": os.path.basename(save_file)})
            print("[serve] saved edits ->", save_file)
        except Exception as e:  # noqa
            self._json(400, {"ok": False, "error": str(e)})

    def end_headers(self):
        # запрещаем кэш, чтобы превью всегда показывало свежий index.html
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # тихо


if __name__ == "__main__":
    os.chdir(DIR)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"[serve] {DIR} on http://127.0.0.1:{PORT}  (RU /__save, EN /__save-en, review /__save-review)")
    httpd.serve_forever()

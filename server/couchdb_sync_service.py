#!/usr/bin/env python3
"""
KIZEN COUCHDB-COMPATIBLE SYNC MICROSERVICE
A lightweight, zero-dependency Python server that implements standard CouchDB 
replication endpoints so your phone can sync to your PC with zero setup.

SECURITY: Optional token auth. Set KIZEN_SYNC_TOKEN env variable to enable:
  Windows:  set KIZEN_SYNC_TOKEN=mysecrettoken
  Then run: py server/couchdb_sync_service.py
"""

import http.server
import json
import os
import socket
import socketserver
import time

PORT = 5984
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_FILE = os.path.join(DATA_DIR, 'kizen_master_db.json')

# Optional auth token — set via env variable KIZEN_SYNC_TOKEN
SYNC_TOKEN = os.environ.get('KIZEN_SYNC_TOKEN', '')

class SyncServer(http.server.BaseHTTPRequestHandler):

    def _check_auth(self):
        """Return True if auth passes (or no token is configured)."""
        if not SYNC_TOKEN:
            return True  # Auth disabled — local-only network
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            return auth_header[7:] == SYNC_TOKEN
        # Also accept token as query param ?token=...
        if f'token={SYNC_TOKEN}' in self.path:
            return True
        return False

    def _send_cors_headers(self):
        # Allow only the known GitHub Pages origin and localhost
        # (falls back to permissive for LAN use without GitHub Pages)
        origin = self.headers.get('Origin', '')
        allowed_origins = [
            'https://rackso555.github.io',
            'http://localhost:8080',
            'http://127.0.0.1:8080'
        ]
        if origin in allowed_origins or not origin:
            self.send_header('Access-Control-Allow-Origin', origin or '*')
        else:
            self.send_header('Access-Control-Allow-Origin', 'https://rackso555.github.io')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With')
        self.send_header('Access-Control-Allow-Credentials', 'true')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _send_unauthorized(self):
        self._send_json(401, {"error": "unauthorized", "reason": "Token required. Set KIZEN_SYNC_TOKEN env variable and pass as Bearer token."})

    def _load_db(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        if not os.path.exists(DB_FILE):
            with open(DB_FILE, 'w') as f:
                json.dump({"docs": {}, "seq": 0}, f)
        try:
            with open(DB_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return {"docs": {}, "seq": 0}

    def _save_db(self, db_data):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(DB_FILE, 'w') as f:
            json.dump(db_data, f, indent=2)

    def log_message(self, format, *args):
        # Suppress verbose access logs for cleanliness
        pass

    def do_GET(self):
        if not self._check_auth():
            self._send_unauthorized()
            return

        path = self.path.split('?')[0]
        db = self._load_db()

        if path in ['/', '']:
            self._send_json(200, {
                "couchdb": "Welcome",
                "version": "3.3.2",
                "vendor": {"name": "Kizen Python Sync Engine"}
            })
            return

        if path == '/_session':
            self._send_json(200, {"ok": True, "userCtx": {"name": "kizen_user", "roles": ["_admin"]}})
            return

        if path in ['/kizen_productivity_db', '/kizen_productivity_db/']:
            self._send_json(200, {
                "db_name": "kizen_productivity_db",
                "doc_count": len(db["docs"]),
                "update_seq": db.get("seq", 0),
                "purge_seq": 0,
                "compact_running": False,
                "sizes": {"active": 1024, "file": 2048}
            })
            return

        if path == '/kizen_productivity_db/_all_docs':
            rows = []
            for doc_id, doc in db["docs"].items():
                rows.append({"id": doc_id, "key": doc_id, "value": {"rev": doc.get("_rev", "1-init")}, "doc": doc})
            self._send_json(200, {
                "total_rows": len(rows),
                "offset": 0,
                "rows": rows
            })
            return

        if path == '/kizen_productivity_db/_changes':
            results = []
            for doc_id, doc in db["docs"].items():
                results.append({
                    "seq": doc.get("_seq", 1),
                    "id": doc_id,
                    "changes": [{"rev": doc.get("_rev", "1-init")}],
                    "doc": doc
                })
            self._send_json(200, {
                "results": results,
                "last_seq": db.get("seq", 0)
            })
            return

        if path.startswith('/kizen_productivity_db/'):
            doc_id = path[len('/kizen_productivity_db/'):]
            if doc_id in db["docs"]:
                self._send_json(200, db["docs"][doc_id])
            else:
                self._send_json(404, {"error": "not_found", "reason": "missing"})
            return

        self._send_json(404, {"error": "not_found"})

    def do_POST(self):
        if not self._check_auth():
            self._send_unauthorized()
            return

        path = self.path.split('?')[0]
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self._send_json(400, {"error": "bad_request", "reason": "Invalid JSON body"})
            return

        db = self._load_db()

        if path in ['/kizen_productivity_db/_revs_diff', '/kizen_productivity_db/_revs_diff/']:
            diff_res = {}
            for doc_id, revs in data.items():
                if not isinstance(revs, list):
                    continue
                server_doc = db["docs"].get(doc_id)
                server_rev = server_doc.get("_rev") if server_doc else None
                missing_revs = [r for r in revs if r != server_rev]
                if missing_revs:
                    diff_res[doc_id] = {"missing": missing_revs}
            self._send_json(200, diff_res)
            return

        if path in ['/kizen_productivity_db/_bulk_docs', '/kizen_productivity_db/_bulk_docs/']:
            docs = data.get("docs", [])
            response_rows = []
            db["seq"] = db.get("seq", 0) + 1

            for d in docs:
                doc_id = d.get("_id")
                if not doc_id:
                    continue

                rev_num = 1
                if "_rev" in d:
                    try:
                        rev_num = int(d["_rev"].split("-")[0]) + 1
                    except Exception:
                        rev_num = 2

                new_rev = f"{rev_num}-{int(time.time()*1000)}"
                d["_rev"] = new_rev
                d["_seq"] = db["seq"]
                db["docs"][doc_id] = d
                response_rows.append({"ok": True, "id": doc_id, "rev": new_rev})

            self._save_db(db)
            self._send_json(201, response_rows)
            return

        self._send_json(404, {"error": "not_found"})

    def do_PUT(self):
        if not self._check_auth():
            self._send_unauthorized()
            return

        path = self.path.split('?')[0]
        if path in ['/kizen_productivity_db', '/kizen_productivity_db/']:
            self._send_json(201, {"ok": True})
            return

        if path.startswith('/kizen_productivity_db/'):
            doc_id = path[len('/kizen_productivity_db/'):]
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                doc = json.loads(body) if body else {}
            except json.JSONDecodeError:
                self._send_json(400, {"error": "bad_request", "reason": "Invalid JSON body"})
                return

            db = self._load_db()
            db["seq"] = db.get("seq", 0) + 1

            rev_num = 1
            if "_rev" in doc:
                try:
                    rev_num = int(doc["_rev"].split("-")[0]) + 1
                except Exception:
                    rev_num = 2

            new_rev = f"{rev_num}-{int(time.time()*1000)}"
            doc["_id"] = doc_id
            doc["_rev"] = new_rev
            doc["_seq"] = db["seq"]
            db["docs"][doc_id] = doc
            self._save_db(db)

            self._send_json(201, {"ok": True, "id": doc_id, "rev": new_rev})
            return

        self._send_json(200, {"ok": True})

def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    auth_status = f"ENABLED (token set via KIZEN_SYNC_TOKEN)" if SYNC_TOKEN else "DISABLED (no token set — LAN only)"

    print("=" * 60)
    print(" Kizen CouchDB Sync Service Running (Port 5984)")
    print("=" * 60)
    print(f" Database: {DB_FILE}")
    print(f" Auth:     {auth_status}")
    print(f" Endpoint: http://<PC_IP>:5984/kizen_productivity_db")
    print("=" * 60)
    if not SYNC_TOKEN:
        print(" TIP: To enable token auth, run with:")
        print("   Windows: set KIZEN_SYNC_TOKEN=your_secret && py server/couchdb_sync_service.py")
    print()

    with socketserver.ThreadingTCPServer(("", PORT), SyncServer) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nSync server stopped.")

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
KIZEN MULTI-THREADED LAN & LOCAL SERVER
Serves PWA static assets with CORS and concurrent threading support across LAN and Wi-Fi.
"""

import http.server
import socket
import os
import sys

PORT = 8080

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    web_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    os.chdir(web_dir)

    lan_ip = get_lan_ip()

    print("=" * 60)
    print(" ⚡ KIZEN MULTI-THREADED WEB SERVER STARTED")
    print("=" * 60)
    print(f" • Local (PC):    http://localhost:{PORT}")
    print(f" • Phone (LAN):   http://{lan_ip}:{PORT}")
    print("=" * 60)
    print(" Instructions for Phone:")
    print(" 1. Ensure phone is on the same Wi-Fi (or Tailscale).")
    print(f" 2. In Chrome/Safari, open: http://{lan_ip}:{PORT}")
    print(" 3. Tap 'Add to Home screen' or 'Install App' for 100% offline usage.")
    print("=" * 60)
    print("Press Ctrl+C in this terminal to stop the server.\n")

    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server_address = ("0.0.0.0", PORT)
    with http.server.ThreadingHTTPServer(server_address, CORSRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    main()

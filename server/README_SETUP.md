# ⚡ Kizen - Multi-Device & PC Sync Setup Guide

This guide explains how to run Kizen on your PC, access it on your cellphone (or any device), and sync your data 100% locally with zero subscription costs.

---

## 1. Running Kizen on your PC

You can start the local web server with 1 command in PowerShell or Terminal:

```powershell
py server/start_server.py
```

- Open **`http://localhost:8080`** in your browser.
- The terminal will display your PC's local network IP (e.g., `http://192.168.1.50:8080`).

---

## 2. Installing on your Cellphone (PWA)

1. Make sure your phone is connected to the same home Wi-Fi network (or your private **Tailscale** VPN).
2. Open Chrome (Android) or Safari (iOS) on your phone.
3. Visit the address shown in your terminal (e.g. `http://192.168.1.50:8080`).
4. **Install as App**:
   - **Android**: Tap the three dots menu `⋮` $\rightarrow$ **"Add to Home screen"** or **"Install app"**.
   - **iOS**: Tap the Share button $\rightarrow$ **"Add to Home Screen"**.
5. Once installed, Kizen opens full-screen like a native app and works **100% offline**.

---

## 3. Syncing Data to your PC (Option 2: CouchDB / PC Sync)

Whenever your PC is turned on, you can sync your phone's database to your PC:

### Option A: Use the Included Python Sync Service (Zero Install)
In a separate terminal window on your PC, run:
```powershell
py server/couchdb_sync_service.py
```
This runs a CouchDB-compatible delta sync engine on port `5984` that writes permanent records to `server/data/kizen_master_db.json`.

### Option B: Use Official Apache CouchDB (Optional)
If you prefer running official Apache CouchDB:
1. Download CouchDB for Windows from [couchdb.apache.org](https://couchdb.apache.org/).
2. Enable CORS in CouchDB configuration.

### Connecting in the App:
1. In the Kizen app on your phone, navigate to the **📊 Stats** screen.
2. Under **💻 CouchDB PC Sync**, enter your PC's URL:
   - `http://192.168.1.50:5984/kizen_productivity_db` (or your Tailscale IP).
3. Tap **⚡ Connect & Sync**.
4. The top header will turn **`🟢 PC Synced`**!

---

## 4. Connecting Outside Home (Tailscale - Free 1-Click VPN)

If you want to sync your phone to your PC while outside the house (e.g. on 4G/5G data):
1. Install **Tailscale** (free forever for personal use) on your PC and on your phone.
2. Log in with the same account.
3. Tailscale gives your PC a permanent private IP (e.g., `100.101.102.103`).
4. Enter `http://100.101.102.103:5984/kizen_productivity_db` in Kizen's sync settings.
5. Whenever your PC is on, your phone will sync from anywhere in the world!

/**
 * KIZEN DATABASE & COUCHDB REPLICATION ENGINE (js/db.js)
 * Manages local IndexedDB via PouchDB and 2-way delta sync with PC CouchDB server.
 */

class DatabaseManager {
  constructor() {
    this.dbName = 'kizen_productivity_db';
    this.localDb = null;
    this.remoteDb = null;
    this.syncHandler = null;
    this.syncStatus = 'offline'; // 'offline' | 'online' | 'syncing' | 'error'
    this.statusListeners = [];
  }

  async init() {
    if (typeof PouchDB === 'undefined') {
      console.warn('PouchDB not loaded. Fallback memory storage will be used.');
      return;
    }

    this.localDb = new PouchDB(this.dbName, {
      auto_compaction: true
    });

    // Check if remote CouchDB URL was saved previously
    const savedRemoteUrl = localStorage.getItem('kizen_couchdb_url');
    if (savedRemoteUrl) {
      this.connectRemote(savedRemoteUrl);
    }
  }

  onSyncStatusChange(callback) {
    this.statusListeners.push(callback);
    callback(this.syncStatus);
  }

  setSyncStatus(status) {
    this.syncStatus = status;
    this.statusListeners.forEach((cb) => {
      try { cb(status); } catch (e) {}
    });
  }

  /**
   * Connect and start 2-way live sync with remote CouchDB instance
   */
  connectRemote(url, credentials = null) {
    try {
      if (this.syncHandler) {
        this.syncHandler.cancel();
      }

      const options = {
        skip_setup: false
      };

      if (credentials && credentials.username && credentials.password) {
        options.auth = {
          username: credentials.username,
          password: credentials.password
        };
      }

      this.remoteDb = new PouchDB(url, options);
      localStorage.setItem('kizen_couchdb_url', url);

      this.syncHandler = this.localDb.sync(this.remoteDb, {
        live: true,
        retry: true
      })
      .on('change', (info) => {
        this.setSyncStatus('syncing');
        window.dispatchEvent(new CustomEvent('kizen-data-synced', { detail: info }));
      })
      .on('paused', (err) => {
        this.setSyncStatus(err ? 'offline' : 'online');
      })
      .on('active', () => {
        this.setSyncStatus('syncing');
      })
      .on('denied', (err) => {
        console.error('CouchDB access denied:', err);
        this.setSyncStatus('error');
      })
      .on('error', (err) => {
        console.warn('CouchDB sync disconnected/offline:', err);
        this.setSyncStatus('offline');
      });

      return { success: true };
    } catch (err) {
      console.error('Failed to configure remote CouchDB:', err);
      this.setSyncStatus('error');
      return { success: false, error: err.message };
    }
  }

  disconnectRemote() {
    if (this.syncHandler) {
      this.syncHandler.cancel();
      this.syncHandler = null;
    }
    this.remoteDb = null;
    localStorage.removeItem('kizen_couchdb_url');
    this.setSyncStatus('offline');
  }

  // --- Document CRUD Methods ---

  async getDoc(id) {
    try {
      return await this.localDb.get(id);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async putDoc(doc) {
    try {
      if (!doc._id) {
        doc._id = `${doc.type || 'doc'}:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      doc.updatedAt = new Date().toISOString();
      const res = await this.localDb.put(doc);
      doc._rev = res.rev;
      return doc;
    } catch (err) {
      if (err.status === 409) {
        // Document conflict: fetch latest rev and retry update
        const latest = await this.localDb.get(doc._id);
        doc._rev = latest._rev;
        doc.updatedAt = new Date().toISOString();
        const retryRes = await this.localDb.put(doc);
        doc._rev = retryRes.rev;
        return doc;
      }
      throw err;
    }
  }

  async removeDoc(docOrId) {
    try {
      let doc = typeof docOrId === 'string' ? await this.localDb.get(docOrId) : docOrId;
      return await this.localDb.remove(doc);
    } catch (err) {
      if (err.status === 404) return true;
      throw err;
    }
  }

  async getAllDocsByType(type) {
    try {
      const prefix = type === 'daily_log' ? 'daily:' : `${type}:`;
      const result = await this.localDb.allDocs({
        include_docs: true,
        startkey: prefix,
        endkey: `${prefix}\ufff0`
      });
      return result.rows.map((row) => row.doc).filter(d => d && (d.type === type || d._id?.startsWith(prefix)));
    } catch (err) {
      console.error(`Error querying docs of type ${type}:`, err);
      return [];
    }
  }

  // --- Backup & Data Portability ---

  async exportAllData() {
    const all = await this.localDb.allDocs({ include_docs: true });
    const docs = all.rows.map((r) => r.doc);
    const backupObj = {
      app: 'kizen',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      documents: docs
    };
    return JSON.stringify(backupObj, null, 2);
  }

  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.documents || !Array.isArray(data.documents)) {
        throw new Error('Invalid Kizen backup file format.');
      }
      // Bulk put documents
      const docsToPut = data.documents.map((d) => {
        const copy = { ...d };
        delete copy._rev; // Remove revs to allow clean import
        return copy;
      });
      await this.localDb.bulkDocs(docsToPut, { new_edits: true });
      return { success: true, count: docsToPut.length };
    } catch (err) {
      console.error('Import failed:', err);
      return { success: false, error: err.message };
    }
  }
}

export const dbManager = new DatabaseManager();

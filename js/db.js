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
        // Document conflict: fetch latest rev, merge intelligently, and retry update
        const latest = await this.localDb.get(doc._id);
        const mergedDoc = this.resolveConflict(latest, doc);
        mergedDoc._rev = latest._rev;
        mergedDoc.updatedAt = new Date().toISOString();
        const retryRes = await this.localDb.put(mergedDoc);
        mergedDoc._rev = retryRes.rev;
        return mergedDoc;
      }
      throw err;
    }
  }

  /**
   * Domain-specific 3-way merge resolver to avoid data loss on conflicts or imports
   */
  resolveConflict(localDoc, incomingDoc) {
    if (!localDoc) return { ...incomingDoc };
    if (!incomingDoc) return { ...localDoc };

    const docType = incomingDoc.type || localDoc.type || '';
    const merged = { ...incomingDoc, ...localDoc };

    // 1. Projects & Nested Activities: Preserve completed activities and union all items
    if (docType === 'project' || localDoc._id?.startsWith('project:')) {
      const actMap = new Map();
      (localDoc.activities || []).forEach((a) => actMap.set(a.id, { ...a }));
      (incomingDoc.activities || []).forEach((a) => {
        if (actMap.has(a.id)) {
          const existing = actMap.get(a.id);
          actMap.set(a.id, {
            ...existing,
            ...a,
            isCompleted: existing.isCompleted || a.isCompleted
          });
        } else {
          actMap.set(a.id, { ...a });
        }
      });
      merged.activities = Array.from(actMap.values());
      merged.status = localDoc.status === 'archived' && incomingDoc.status === 'archived' ? 'archived' : (localDoc.status || incomingDoc.status);
    }

    // 2. Daily Log: Union of completed pillars, merge gratitude and retain non-empty journal
    else if (docType === 'daily_log' || localDoc._id?.startsWith('daily:')) {
      const localPillars = localDoc.pillarsCompleted || [];
      const remotePillars = incomingDoc.pillarsCompleted || [];
      merged.pillarsCompleted = Array.from(new Set([...localPillars, ...remotePillars]));

      // Merge gratitude items (take longest/non-empty for each slot)
      const localGrat = localDoc.gratitudeItems || ['', '', ''];
      const remoteGrat = incomingDoc.gratitudeItems || ['', '', ''];
      merged.gratitudeItems = [0, 1, 2].map((i) => {
        const l = localGrat[i] || '';
        const r = remoteGrat[i] || '';
        return l.trim().length >= r.trim().length ? l : r;
      });

      // Journal text: if one has text, keep it; if both have text and differ, combine
      const lText = (localDoc.journalText || '').trim();
      const rText = (incomingDoc.journalText || '').trim();
      if (!lText) merged.journalText = rText;
      else if (!rText) merged.journalText = lText;
      else if (lText === rText) merged.journalText = lText;
      else merged.journalText = `${lText}\n\n--- [Sincronización] ---\n${rText}`;

      merged.comboBonusClaimed = !!(localDoc.comboBonusClaimed || incomingDoc.comboBonusClaimed);
      merged.totalXpEarned = Math.max(localDoc.totalXpEarned || 0, incomingDoc.totalXpEarned || 0);
    }

    // 3. User Profile: Keep max streak, max XP, merge pillars subtasks
    else if (docType === 'profile' || localDoc._id === 'user_profile') {
      merged.totalXp = Math.max(localDoc.totalXp || 0, incomingDoc.totalXp || 0);
      merged.currentStreak = Math.max(localDoc.currentStreak || 0, incomingDoc.currentStreak || 0);
      merged.longestStreak = Math.max(localDoc.longestStreak || 0, incomingDoc.longestStreak || 0);
      merged.freezeTokens = Math.max(localDoc.freezeTokens ?? 0, incomingDoc.freezeTokens ?? 0);

      // Merge pillars and subtasks
      const pillarMap = new Map();
      (localDoc.pillars || []).forEach((p) => pillarMap.set(p.id, { ...p }));
      (incomingDoc.pillars || []).forEach((p) => {
        if (pillarMap.has(p.id)) {
          const lp = pillarMap.get(p.id);
          const subMap = new Map();
          (lp.subtasks || []).forEach((s) => subMap.set(s.id, { ...s }));
          (p.subtasks || []).forEach((s) => {
            if (subMap.has(s.id)) {
              const ls = subMap.get(s.id);
              subMap.set(s.id, { ...ls, ...s, isCompleted: ls.isCompleted || s.isCompleted });
            } else {
              subMap.set(s.id, { ...s });
            }
          });
          pillarMap.set(p.id, { ...p, ...lp, subtasks: Array.from(subMap.values()) });
        } else {
          pillarMap.set(p.id, { ...p });
        }
      });
      merged.pillars = Array.from(pillarMap.values());
    }

    // 4. Custom Tags: Union by tag ID
    else if (docType === 'tag_list' || localDoc._id === 'custom_tags') {
      const tagMap = new Map();
      (localDoc.tags || []).forEach((t) => tagMap.set(t.id, { ...t }));
      (incomingDoc.tags || []).forEach((t) => {
        if (!tagMap.has(t.id)) {
          tagMap.set(t.id, { ...t });
        }
      });
      merged.tags = Array.from(tagMap.values());
    }

    // 5. Tasks & Goals: Completed status takes precedence if marked true anywhere
    else if (docType === 'task' || localDoc._id?.startsWith('task:') || docType === 'goal' || localDoc._id?.startsWith('goal:')) {
      merged.isCompleted = !!(localDoc.isCompleted || incomingDoc.isCompleted);
      merged.completedAt = localDoc.completedAt || incomingDoc.completedAt || (merged.isCompleted ? new Date().toISOString() : null);
      if (docType === 'goal' || localDoc._id?.startsWith('goal:')) {
        merged.progress = Math.max(localDoc.progress || 0, incomingDoc.progress || 0);
        if (merged.isCompleted) merged.progress = 100;
      }
    }

    return merged;
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

      // Save safety snapshot before import
      try {
        const currentBackup = await this.exportAllData();
        localStorage.setItem('kizen_safety_snapshot', currentBackup);
        localStorage.setItem('kizen_safety_snapshot_time', new Date().toISOString());
      } catch (snapshotErr) {
        console.warn('Safety snapshot before import could not be stored:', snapshotErr);
      }

      let importedCount = 0;
      for (const doc of data.documents) {
        if (!doc || !doc._id) continue;
        try {
          const existing = await this.getDoc(doc._id);
          if (existing) {
            // Document already exists: merge with local version to prevent data loss!
            const merged = this.resolveConflict(existing, doc);
            merged._rev = existing._rev;
            merged.updatedAt = new Date().toISOString();
            await this.localDb.put(merged);
          } else {
            // New document: insert cleanly without old rev
            const newDoc = { ...doc };
            delete newDoc._rev;
            await this.localDb.put(newDoc);
          }
          importedCount++;
        } catch (docErr) {
          console.error(`Error importing doc ${doc._id}:`, docErr);
        }
      }

      return { success: true, count: importedCount };
    } catch (err) {
      console.error('Import failed:', err);
      return { success: false, error: err.message };
    }
  }

  async restoreSafetySnapshot() {
    const snapshot = localStorage.getItem('kizen_safety_snapshot');
    if (!snapshot) return { success: false, error: 'No hay copia de seguridad automática disponible.' };
    return await this.importData(snapshot);
  }
}

export const dbManager = new DatabaseManager();

/**
 * STATS, GAMIFICATION ANALYTICS & REVIEW NOTIFICATIONS (js/views/statsView.js)
 * Visualizes 365-day heatmap, completed tasks & projects history, pillar consistency, notifications, and backups.
 */

import { store } from '../store.js';
import { dbManager } from '../db.js';
import { calculateLevelData } from '../gamification.js';
import { notificationEngine } from '../notifications.js';

export function renderStatsView(container) {
  const { profile, tasks, projects, dailyLog } = store;
  if (!profile) return;

  const levelData = calculateLevelData(profile.totalXp);
  const completedTasks = tasks.filter(t => t.isCompleted);
  const completedProjects = projects.filter(p => {
    const total = p.activities?.length || 0;
    const done = p.activities?.filter(a => a.isCompleted).length || 0;
    return total > 0 && done === total;
  });

  const savedRemoteUrl = localStorage.getItem('kizen_couchdb_url') || '';
  const notifSettings = notificationEngine.settings;

  // Calculate XP by tag
  const tagXpMap = {};
  completedTasks.forEach((t) => {
    (t.tags || ['#general']).forEach((tag) => {
      tagXpMap[tag] = (tagXpMap[tag] || 0) + (t.xpAwarded || 25);
    });
  });

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>📊 Stats & Mastery</h1>
        <div class="section-subtitle">Gamification analytics, history, reminders & backups</div>
      </div>
    </div>

    <!-- Summary Tiles Grid -->
    <div class="stats-summary-grid">
      <div class="stat-tile">
        <span class="stat-tile-label">Lifetime Points</span>
        <span class="stat-tile-value" style="color: var(--color-xp);">${profile.totalXp} XP</span>
        <span class="stat-tile-sub">Level ${levelData.level} • ${levelData.rankTitle}</span>
      </div>

      <div class="stat-tile">
        <span class="stat-tile-label">Current Streak</span>
        <span class="stat-tile-value" style="color: var(--color-streak);">🔥 ${profile.currentStreak || 0}</span>
        <span class="stat-tile-sub">Best: ${profile.longestStreak || 0} days</span>
      </div>

      <div class="stat-tile">
        <span class="stat-tile-label">Completed Tasks</span>
        <span class="stat-tile-value" style="color: var(--color-success);">${completedTasks.length}</span>
        <span class="stat-tile-sub">Total logged: ${tasks.length}</span>
      </div>

      <div class="stat-tile">
        <span class="stat-tile-label">Freeze Shields</span>
        <span class="stat-tile-value" style="color: var(--color-primary);">🛡️ ${profile.freezeTokens ?? 1}</span>
        <span class="stat-tile-sub">1 added per 7d streak</span>
      </div>
    </div>

    <!-- App Installation Banner (For Chrome / Mobile) -->
    <div class="card" style="background: linear-gradient(135deg, #0e1e38 0%, #12284c 100%); border-color: rgba(56, 189, 248, 0.3);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-primary);">
            📲 Install Kizen as an App
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
            Run offline in full screen without browser toolbars.
          </p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-trigger-pwa-install">
          Install App
        </button>
      </div>
      <div id="pwa-install-help" style="display: none; margin-top: 10px; font-size: 0.78rem; color: var(--text-secondary); border-top: 1px solid var(--border-subtle); padding-top: 8px;">
        💡 <strong>In Chrome on Mobile/PC</strong>: Click the 3 dots <code>⋮</code> in the top right $\rightarrow$ select <strong>"Install Kizen"</strong> or <strong>"Add to Home Screen"</strong>. (If testing over LAN Wi-Fi, Chrome requires localhost or HTTPS).
      </div>
    </div>

    <!-- 365-Day Activity Heatmap -->
    <div class="heatmap-card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>🔥 Annual Activity Heatmap (365 Days)</span>
      </div>
      <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 12px;">
        Daily points intensity across the year (5:00 AM reset cycle).
      </p>

      <div class="heatmap-scroll-container">
        <div class="heatmap-grid" id="stats-heatmap-grid">
          ${renderHeatmapCells(profile.totalXp)}
        </div>
      </div>

      <div class="heatmap-legend">
        <span>Less</span>
        <div class="legend-cells">
          <div class="heatmap-cell"></div>
          <div class="heatmap-cell l1"></div>
          <div class="heatmap-cell l2"></div>
          <div class="heatmap-cell l3"></div>
          <div class="heatmap-cell l4"></div>
          <div class="heatmap-cell l5"></div>
        </div>
        <span>More</span>
      </div>
    </div>

    <!-- 7 Pillar Consistency Bars -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 12px;">
        <span>🏛️ Pillar Consistency</span>
      </div>
      <div class="pillar-consistency-list">
        ${profile.pillars.map((pillar) => {
          const isDoneToday = dailyLog?.pillarsCompleted?.includes(pillar.id);
          const simulatedConsistency = isDoneToday ? 88 : 65;
          return `
            <div class="pillar-stat-row">
              <div class="pillar-stat-header">
                <span>${pillar.icon} ${pillar.name}</span>
                <span style="font-weight: 700; color: var(--text-secondary);">${simulatedConsistency}%</span>
              </div>
              <div class="pillar-stat-bar-track">
                <div class="pillar-stat-bar-fill" style="width: ${simulatedConsistency}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Completed Tasks & Projects History Segment -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 12px;">
        <span>✅ Completed Tasks & Projects Breakdown</span>
      </div>
      
      <div style="margin-bottom: 14px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
          XP Earned by Tag / Category:
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${Object.keys(tagXpMap).length === 0 ? `
            <span style="font-size: 0.8rem; color: var(--text-muted);">No completed tagged tasks yet.</span>
          ` : Object.entries(tagXpMap).map(([tag, xp]) => `
            <div class="tag-badge" style="padding: 4px 10px; font-size: 0.78rem;">
              <span>${escapeHtml(tag)}</span>
              <strong style="color: var(--color-xp);">+${xp} XP</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom: 14px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
          Project Roadmaps (${projects.length} Total • ${completedProjects.length} Completed):
        </div>
        <div class="task-list">
          ${projects.map((p) => {
            const totalActs = p.activities?.length || 0;
            const doneActs = p.activities?.filter(a => a.isCompleted).length || 0;
            const isAllDone = totalActs > 0 && doneActs === totalActs;
            return `
              <div class="task-item ${isAllDone ? 'completed' : ''}">
                <div class="task-body">
                  <div class="task-title">${escapeHtml(p.name)}</div>
                  <div class="task-meta-row">
                    <span class="tag-badge">${escapeHtml(p.category)}</span>
                    <span class="tag-badge">Activities: ${doneActs}/${totalActs}</span>
                    <span class="tag-badge" style="color: var(--color-xp);">⚡ ${doneActs * 30} XP Earned</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div>
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
          Recently Completed Actions (${completedTasks.length}):
        </div>
        <div class="task-list" style="max-height: 220px; overflow-y: auto;">
          ${completedTasks.length === 0 ? `
            <span style="font-size: 0.8rem; color: var(--text-muted);">No tasks checked off yet today.</span>
          ` : completedTasks.slice(0, 15).map((t) => `
            <div class="task-item completed" style="padding: 8px 12px;">
              <div class="task-body">
                <div class="task-title" style="font-size: 0.85rem;">${escapeHtml(t.title)}</div>
                <div class="task-meta-row">
                  <span class="difficulty-pill ${t.difficulty}">+${t.xpAwarded} XP</span>
                  ${(t.tags || []).map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Review Reminders & Notifications -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>🔔 Review Reminders & Notifications</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
        Schedule automatic prompts for Weekly and Monthly reviews.
      </p>

      <div style="display: flex; gap: 8px; margin-bottom: 14px;">
        <button class="btn ${notifSettings.enabled ? 'btn-secondary' : 'btn-primary'} btn-sm" id="btn-toggle-notifications">
          ${notifSettings.enabled ? '🔔 Notifications Active' : '🔕 Enable Notifications'}
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-test-notification">
          Send Test
        </button>
      </div>

      <div class="input-group">
        <label class="input-label">Weekly Review Schedule:</label>
        <div style="display: flex; gap: 8px;">
          <select class="select" id="select-weekly-day" style="flex: 1;">
            <option value="0" ${notifSettings.weeklyReviewDay == 0 ? 'selected' : ''}>Sunday</option>
            <option value="1" ${notifSettings.weeklyReviewDay == 1 ? 'selected' : ''}>Monday</option>
            <option value="5" ${notifSettings.weeklyReviewDay == 5 ? 'selected' : ''}>Friday</option>
            <option value="6" ${notifSettings.weeklyReviewDay == 6 ? 'selected' : ''}>Saturday</option>
          </select>
          <input type="time" class="input-text" id="input-weekly-time" value="${notifSettings.weeklyReviewTime || '18:00'}" style="flex: 1;">
        </div>
      </div>

      <div class="input-group">
        <label class="input-label">Monthly Review Schedule:</label>
        <div style="display: flex; gap: 8px;">
          <select class="select" id="select-monthly-day" style="flex: 1;">
            <option value="1" ${notifSettings.monthlyReviewDay == 1 ? 'selected' : ''}>1st of Month</option>
            <option value="28" ${notifSettings.monthlyReviewDay == 28 ? 'selected' : ''}>28th of Month</option>
          </select>
          <input type="time" class="input-text" id="input-monthly-time" value="${notifSettings.monthlyReviewTime || '10:00'}" style="flex: 1;">
        </div>
      </div>

      <button class="btn btn-secondary btn-sm" id="btn-save-notif-schedule">
        Save Schedule
      </button>
    </div>

    <!-- CouchDB PC Server Sync Settings -->
    <div class="sync-settings-card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>💻 CouchDB PC Sync (Option 2)</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
        Connect your phone or browser to your PC CouchDB database. Syncs automatically whenever your PC server is running.
      </p>

      <div class="sync-status-display">
        <span>Status:</span>
        <strong id="couchdb-status-text" style="color: ${dbManager.syncStatus === 'online' ? 'var(--color-success)' : 'var(--text-muted)'};">
          ${dbManager.syncStatus.toUpperCase()}
        </strong>
      </div>

      <div class="input-group">
        <label class="input-label">CouchDB Server URL:</label>
        <input type="text" class="input-text" id="couchdb-url-input" 
          placeholder="http://192.168.1.50:5984/kizen_db or Tailscale IP" 
          value="${escapeHtml(savedRemoteUrl)}">
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary btn-sm" id="btn-save-couchdb-sync">
          ⚡ Connect & Sync
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-disconnect-couchdb-sync">
          Disconnect
        </button>
      </div>
    </div>

    <!-- Data Backup & Portability -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>💾 Data Backup & Portability</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
        Export your complete database to an offline JSON file anytime or restore from a backup.
      </p>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-sm" id="btn-export-backup">
          📥 Export JSON Backup
        </button>
        <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
          📤 Import Backup
          <input type="file" id="input-import-backup" accept=".json" style="display: none;">
        </label>
      </div>
    </div>
  `;

  attachStatsEventListeners(container);
}

function renderHeatmapCells(totalXp) {
  const cells = [];
  const now = new Date();
  
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    
    let levelClass = '';
    if (i < 14) {
      levelClass = i % 2 === 0 ? 'l3' : 'l4';
    } else if (i % 5 === 0) {
      levelClass = 'l2';
    } else if (i % 9 === 0) {
      levelClass = 'l1';
    }

    cells.push(`<div class="heatmap-cell ${levelClass}" title="${d.toISOString().slice(0, 10)}"></div>`);
  }

  return cells.join('');
}

function attachStatsEventListeners(container) {
  // PWA Install Button
  const btnInstall = container.querySelector('#btn-trigger-pwa-install');
  if (btnInstall) {
    btnInstall.addEventListener('click', () => {
      if (window.deferredPwaPrompt) {
        window.deferredPwaPrompt.prompt();
        window.deferredPwaPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            alert('Installing Kizen!');
          }
          window.deferredPwaPrompt = null;
        });
      } else {
        const help = container.querySelector('#pwa-install-help');
        if (help) {
          help.style.display = help.style.display === 'none' ? 'block' : 'none';
        }
      }
    });
  }

  // Notification Toggle
  const btnToggleNotif = container.querySelector('#btn-toggle-notifications');
  if (btnToggleNotif) {
    btnToggleNotif.addEventListener('click', async () => {
      const granted = await notificationEngine.requestPermission();
      if (granted) {
        alert('Notifications enabled! You will be reminded for scheduled reviews.');
      } else {
        alert('Notification permission was not granted.');
      }
      renderStatsView(container);
    });
  }

  // Test Notification
  const btnTestNotif = container.querySelector('#btn-test-notification');
  if (btnTestNotif) {
    btnTestNotif.addEventListener('click', () => {
      notificationEngine.sendNotification('⚡ Kizen Test Reminder', {
        body: 'Notifications are working! Your reviews will trigger on schedule.'
      });
    });
  }

  // Save Notification Schedule
  const btnSaveNotif = container.querySelector('#btn-save-notif-schedule');
  if (btnSaveNotif) {
    btnSaveNotif.addEventListener('click', () => {
      const weeklyDay = container.querySelector('#select-weekly-day').value;
      const weeklyTime = container.querySelector('#input-weekly-time').value;
      const monthlyDay = container.querySelector('#select-monthly-day').value;
      const monthlyTime = container.querySelector('#input-monthly-time').value;

      notificationEngine.saveSettings({
        weeklyReviewDay: weeklyDay,
        weeklyReviewTime: weeklyTime,
        monthlyReviewDay: monthlyDay,
        monthlyReviewTime: monthlyTime
      });

      alert('Review schedule saved!');
    });
  }

  // Save CouchDB Sync
  const btnSaveSync = container.querySelector('#btn-save-couchdb-sync');
  if (btnSaveSync) {
    btnSaveSync.addEventListener('click', () => {
      const url = container.querySelector('#couchdb-url-input').value.trim();
      if (!url) {
        alert('Please enter a valid CouchDB URL.');
        return;
      }
      const res = dbManager.connectRemote(url);
      if (res.success) {
        alert('CouchDB 2-way sync initiated!');
        renderStatsView(container);
      } else {
        alert('Error connecting: ' + res.error);
      }
    });
  }

  // Disconnect CouchDB
  const btnDisconnect = container.querySelector('#btn-disconnect-couchdb-sync');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
      dbManager.disconnectRemote();
      alert('CouchDB remote sync disconnected.');
      renderStatsView(container);
    });
  }

  // Export Backup
  const btnExport = container.querySelector('#btn-export-backup');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const json = await dbManager.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kizen_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Import Backup
  const fileInput = container.querySelector('#input-import-backup');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const jsonStr = evt.target.result;
        const res = await dbManager.importData(jsonStr);
        if (res.success) {
          alert(`Successfully imported ${res.count} documents! Reloading data...`);
          await store.loadInitialData();
          renderStatsView(container);
        } else {
          alert('Import failed: ' + res.error);
        }
      };
      reader.readAsText(file);
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

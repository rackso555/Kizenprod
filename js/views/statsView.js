/**
 * STATS, GAMIFICATION ANALYTICS & REVIEW NOTIFICATIONS (js/views/statsView.js)
 * Visualizes 365-day heatmap, real pillar consistency, grouped completed activities history,
 * streak freeze refills, notifications scheduler, and backups.
 */

import { store } from '../store.js';
import { dbManager } from '../db.js';
import { calculateLevelData, MAX_FREEZE_SHIELDS, FREEZE_SHIELD_COST_XP } from '../gamification.js';
import { notificationEngine } from '../notifications.js';

let activitySearchQuery = '';
let heatmapRangePreset = 'all'; // '30d' | '90d' | 'ytd' | 'all'

export async function renderStatsView(container) {
  const { profile, tasks, projects } = store;
  if (!profile) return;

  const levelData = calculateLevelData(profile.totalXp);
  const completedTasks = tasks.filter(t => t.isCompleted);
  
  // Real Pillar Consistency Stats & Real Daily Logs for Heatmap
  const pillarStats = await store.getPillarConsistencyStats();
  const allDailyLogs = await dbManager.getAllDocsByType('daily_log');
  const heatmapData = generateRealHeatmapData(allDailyLogs, tasks, store.currentLogicalDate, heatmapRangePreset);

  const savedRemoteUrl = localStorage.getItem('kizen_couchdb_url') || '';
  const notifSettings = notificationEngine.settings;

  // Calculate XP by tag
  const tagXpMap = {};
  completedTasks.forEach((t) => {
    (t.tags || ['#general']).forEach((tag) => {
      tagXpMap[tag] = (tagXpMap[tag] || 0) + (t.xpAwarded || 25);
    });
  });

  // Group ALL completed activities (manual tasks + project activities) by normalized title
  const allCompletedItems = [
    ...completedTasks.map(t => ({
      title: t.title,
      xpAwarded: t.xpAwarded || 25,
      tags: t.tags || ['#tarea'],
      source: 'Tarea'
    })),
    ...projects.flatMap(p => (p.activities || []).filter(a => a.isCompleted).map(a => ({
      title: a.title,
      xpAwarded: 30,
      tags: [p.category || 'Proyecto'],
      source: `Proyecto: ${p.name}`
    })))
  ];

  const groupedActivitiesMap = {};
  allCompletedItems.forEach((item) => {
    const key = item.title.trim().toLowerCase();
    if (!groupedActivitiesMap[key]) {
      groupedActivitiesMap[key] = {
        title: item.title.trim(),
        count: 0,
        totalXp: 0,
        tags: new Set(),
        sources: new Set()
      };
    }
    groupedActivitiesMap[key].count += 1;
    groupedActivitiesMap[key].totalXp += item.xpAwarded;
    (item.tags || []).forEach(t => groupedActivitiesMap[key].tags.add(t));
    groupedActivitiesMap[key].sources.add(item.source);
  });

  let groupedList = Object.values(groupedActivitiesMap).sort((a, b) => b.count - a.count);

  if (activitySearchQuery.trim()) {
    const q = activitySearchQuery.toLowerCase().trim();
    groupedList = groupedList.filter(g => g.title.toLowerCase().includes(q));
  }

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>📊 Estadísticas & Maestría</h1>
        <div class="section-subtitle">Analíticas reales de consistencia, historial de tareas, racha y recordatorios</div>
      </div>
    </div>

    <!-- Summary Tiles Grid -->
    <div class="stats-summary-grid">
      <div class="stat-tile">
        <span class="stat-tile-label">Puntos Totales</span>
        <span class="stat-tile-value" style="color: var(--color-xp);">${profile.totalXp} XP</span>
        <span class="stat-tile-sub">Nivel ${levelData.level} • ${levelData.rankTitle}</span>
      </div>

      <div class="stat-tile">
        <span class="stat-tile-label">Racha Actual</span>
        <span class="stat-tile-value" style="color: var(--color-streak);">🔥 ${profile.currentStreak || 0}</span>
        <span class="stat-tile-sub">Récord: ${profile.longestStreak || 0} días</span>
      </div>

      <div class="stat-tile">
        <span class="stat-tile-label">Acciones Completadas</span>
        <span class="stat-tile-value" style="color: var(--color-success);">${allCompletedItems.length}</span>
        <span class="stat-tile-sub">${groupedList.length} actividades únicas</span>
      </div>

      <div class="stat-tile" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="stat-tile-label">Escudos de Racha</span>
          <span class="stat-tile-value" style="color: var(--color-primary);">🛡️ ${profile.freezeTokens ?? 1} / ${MAX_FREEZE_SHIELDS}</span>
          <span class="stat-tile-sub">+1 cada 7d de racha</span>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-refill-freeze-shield" style="margin-top: 8px; font-size: 0.72rem; padding: 4px 8px;">
          + Recargar (${FREEZE_SHIELD_COST_XP} XP)
        </button>
      </div>
    </div>

    <!-- Real Activity Heatmap (100% Real Logs!) -->
    <div class="heatmap-card">
      <div class="section-title" style="margin-bottom: 6px;">
        <span>🔥 Mapa de Calor de Actividad Real</span>
      </div>
      <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 10px;">
        Intensidad de productividad basada 100% en tus registros guardados (ciclo 5:00 AM).
      </p>

      <!-- Range Preset Buttons -->
      <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
        <button class="btn btn-sm ${heatmapRangePreset === '30d' ? 'btn-primary' : 'btn-ghost'} btn-heatmap-range" data-range="30d" style="font-size: 0.72rem; padding: 4px 8px;">30 Días</button>
        <button class="btn btn-sm ${heatmapRangePreset === '90d' ? 'btn-primary' : 'btn-ghost'} btn-heatmap-range" data-range="90d" style="font-size: 0.72rem; padding: 4px 8px;">90 Días</button>
        <button class="btn btn-sm ${heatmapRangePreset === 'ytd' ? 'btn-primary' : 'btn-ghost'} btn-heatmap-range" data-range="ytd" style="font-size: 0.72rem; padding: 4px 8px;">Año Actual</button>
        <button class="btn btn-sm ${heatmapRangePreset === 'all' ? 'btn-primary' : 'btn-ghost'} btn-heatmap-range" data-range="all" style="font-size: 0.72rem; padding: 4px 8px;">★ Todo (${heatmapData.earliestDate})</button>
      </div>

      <div class="heatmap-scroll-container">
        <div class="heatmap-grid" id="stats-heatmap-grid">
          ${heatmapData.htmlCells}
        </div>
      </div>

      <!-- Cell Info Display Bar (Hover/Click) -->
      <div id="heatmap-cell-inspector" style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 8px; min-height: 20px; font-weight: 600;">
        Pasa el cursor o toca una celda para ver métricas del día.
      </div>

      <div class="heatmap-legend" style="margin-top: 8px;">
        <span>Menos</span>
        <div class="legend-cells">
          <div class="heatmap-cell" title="0 XP / Sin registro"></div>
          <div class="heatmap-cell l1" title="1-49 XP"></div>
          <div class="heatmap-cell l2" title="50-99 XP"></div>
          <div class="heatmap-cell l3" title="100-199 XP"></div>
          <div class="heatmap-cell l4" title="200+ XP"></div>
        </div>
        <span>Más</span>
      </div>
    </div>

    <!-- 7 Pillar Consistency Bars (REAL DATA!) -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>🏛️ Consistencia Real de Pilares</span>
      </div>
      <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 12px;">
        Porcentaje histórico exacto basado en todos los registros diarios guardados en tu base de datos.
      </p>
      
      <div class="pillar-consistency-list">
        ${pillarStats.map((pillar) => `
          <div class="pillar-stat-row">
            <div class="pillar-stat-header">
              <span>${pillar.icon} ${pillar.name}</span>
              <span style="font-weight: 700; color: var(--text-secondary);">
                ${pillar.daysCompleted}/${pillar.totalDaysRecorded} días (${pillar.percentage}%)
              </span>
            </div>
            <div class="pillar-stat-bar-track">
              <div class="pillar-stat-bar-fill" style="width: ${pillar.percentage}%;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Grouped Completed Activities History -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 6px;">
        <span>✅ Historial de Actividades Completadas</span>
      </div>
      <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 12px;">
        Todas las actividades y tareas realizadas agrupadas por nombre con contador de repeticiones y XP total.
      </p>

      <!-- Search bar -->
      <div style="margin-bottom: 12px;">
        <input type="text" class="input-text" id="stats-search-activities" 
          placeholder="🔍 Filtrar actividad por nombre..." value="${escapeHtml(activitySearchQuery)}" style="font-size: 0.85rem;">
      </div>
      
      <!-- XP by Tag -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
          Puntos por Categoría / Tag:
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${Object.keys(tagXpMap).length === 0 ? `
            <span style="font-size: 0.8rem; color: var(--text-muted);">Sin tareas etiquetadas completadas aún.</span>
          ` : Object.entries(tagXpMap).map(([tag, xp]) => `
            <div class="tag-badge" style="padding: 4px 10px; font-size: 0.76rem;">
              <span>${escapeHtml(tag)}</span>
              <strong style="color: var(--color-xp);">+${xp} XP</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Grouped List -->
      <div class="task-list" style="max-height: 280px; overflow-y: auto;">
        ${groupedList.length === 0 ? `
          <div style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 16px;">
            No hay actividades completadas registradas con ese criterio.
          </div>
        ` : groupedList.map((item) => `
          <div class="task-item completed" style="padding: 8px 12px; margin-bottom: 6px;">
            <div class="task-body">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="task-title" style="font-size: 0.88rem; font-weight: 600;">
                  ${escapeHtml(item.title)}
                </div>
                <span class="tag-badge" style="background: rgba(56, 189, 248, 0.15); color: var(--color-primary); font-weight: 700; font-size: 0.74rem;">
                  x${item.count} ${item.count === 1 ? 'vez' : 'veces'}
                </span>
              </div>
              <div class="task-meta-row" style="margin-top: 4px;">
                <span class="difficulty-pill medium">+${item.totalXp} XP Acumulados</span>
                ${Array.from(item.tags).map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}
                ${Array.from(item.sources).map(src => `<span class="tag-badge" style="opacity: 0.8;">📍 ${escapeHtml(src)}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Review Reminders & Notifications -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>🔔 Configuración de Notificaciones & Recordatorios</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
        Recibe recordatorios diarios para tus pilares y avisos para las revisiones semanales y mensuales.
      </p>

      <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
        <button class="btn ${notifSettings.enabled ? 'btn-secondary' : 'btn-primary'} btn-sm" id="btn-toggle-notifications">
          ${notifSettings.enabled ? '🔔 Notificaciones Activas (Click para apagar)' : '🔕 Activar Notificaciones'}
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-test-notification">
          Enviar Prueba
        </button>
      </div>

      <div class="input-group">
        <label class="input-label">☀️ Recordatorio Diario Matutino:</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="time" class="input-text" id="input-daily-reminder-time" value="${notifSettings.dailyReminderTime || '09:00'}" style="flex: 1;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">Hora de inicio del día</span>
        </div>
      </div>

      <div class="input-group">
        <label class="input-label">📅 Revisión Semanal (Sprint Review):</label>
        <div style="display: flex; gap: 8px;">
          <select class="select" id="select-weekly-day" style="flex: 1;">
            <option value="0" ${notifSettings.weeklyReviewDay == 0 ? 'selected' : ''}>Domingo</option>
            <option value="1" ${notifSettings.weeklyReviewDay == 1 ? 'selected' : ''}>Lunes</option>
            <option value="5" ${notifSettings.weeklyReviewDay == 5 ? 'selected' : ''}>Viernes</option>
            <option value="6" ${notifSettings.weeklyReviewDay == 6 ? 'selected' : ''}>Sábado</option>
          </select>
          <input type="time" class="input-text" id="input-weekly-time" value="${notifSettings.weeklyReviewTime || '18:00'}" style="flex: 1;">
        </div>
      </div>

      <div class="input-group">
        <label class="input-label">🗓️ Revisión Mensual (OKRs & Visión):</label>
        <div style="display: flex; gap: 8px;">
          <select class="select" id="select-monthly-day" style="flex: 1;">
            <option value="1" ${notifSettings.monthlyReviewDay == 1 ? 'selected' : ''}>Día 1 del Mes</option>
            <option value="28" ${notifSettings.monthlyReviewDay == 28 ? 'selected' : ''}>Día 28 del Mes</option>
          </select>
          <input type="time" class="input-text" id="input-monthly-time" value="${notifSettings.monthlyReviewTime || '10:00'}" style="flex: 1;">
        </div>
      </div>

      <button class="btn btn-primary btn-sm" id="btn-save-notif-schedule">
        💾 Guardar Horarios de Recordatorio
      </button>
    </div>

    <!-- CouchDB PC Server Sync Settings -->
    <div class="sync-settings-card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>💻 Sincronización con Servidor PC</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
        Conecta tu teléfono o navegador a la base de datos de tu PC vía Wi-Fi o Tailscale.
      </p>

      <div class="sync-status-display">
        <span>Estado:</span>
        <strong id="couchdb-status-text" style="color: ${dbManager.syncStatus === 'online' ? 'var(--color-success)' : 'var(--text-muted)'};">
          ${dbManager.syncStatus.toUpperCase()}
        </strong>
      </div>

      <div class="input-group">
        <label class="input-label">URL del Servidor CouchDB:</label>
        <input type="text" class="input-text" id="couchdb-url-input" 
          placeholder="http://192.168.1.50:5984/kizen_db o IP de Tailscale" 
          value="${escapeHtml(savedRemoteUrl)}">
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary btn-sm" id="btn-save-couchdb-sync">
          ⚡ Conectar & Sincronizar
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-disconnect-couchdb-sync">
          Desconectar
        </button>
      </div>
    </div>

    <!-- Data Backup & Portability -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>💾 Copia de Seguridad & Portabilidad</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
        Exporta tu base de datos completa a un archivo JSON offline, restaura tus datos o recupera el último snapshot local.
      </p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary btn-sm" id="btn-export-backup">
          📥 Exportar Copia JSON
        </button>
        <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
          📤 Importar Copia
          <input type="file" id="input-import-backup" accept=".json" style="display: none;">
        </label>
        <button class="btn btn-secondary btn-sm" id="btn-restore-safety-snapshot" style="border-style: dashed;" title="Restaura la última copia de seguridad automática guardada localmente">
          🛡️ Restaurar Snapshot Local
        </button>
      </div>
    </div>
  `;

  attachStatsEventListeners(container);
}

function generateRealHeatmapData(dailyLogs, tasks, currentLogicalDate, rangePreset) {
  const logMap = {};
  (dailyLogs || []).forEach((l) => { if (l && l.date) logMap[l.date] = l; });

  const taskCounts = {};
  (tasks || []).forEach((t) => {
    if (t.isCompleted && t.scheduledDate) {
      taskCounts[t.scheduledDate] = (taskCounts[t.scheduledDate] || 0) + 1;
    }
  });

  // Collect real dates recorded
  const datesRecorded = Object.keys(logMap);
  Object.keys(taskCounts).forEach((d) => {
    if (!datesRecorded.includes(d)) datesRecorded.push(d);
  });
  if (!datesRecorded.includes(currentLogicalDate)) {
    datesRecorded.push(currentLogicalDate);
  }
  datesRecorded.sort();

  const earliestDate = datesRecorded[0] || currentLogicalDate;
  const now = new Date(currentLogicalDate + 'T12:00:00');

  let startDate = new Date(earliestDate + 'T12:00:00');
  if (rangePreset === '30d') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 29);
  } else if (rangePreset === '90d') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 89);
  } else if (rangePreset === 'ytd') {
    startDate = new Date(now.getFullYear(), 0, 1, 12, 0, 0);
  }

  if (startDate > now) startDate = new Date(now);

  const cells = [];
  const curr = new Date(startDate);

  while (curr <= now) {
    const dStr = curr.toISOString().slice(0, 10);
    const log = logMap[dStr];
    const tCount = taskCounts[dStr] || 0;
    const pCount = (log?.pillarsCompleted || []).length;
    const xp = log?.totalXpEarned || 0;

    let levelClass = '';
    if (xp >= 200 || pCount >= 6) {
      levelClass = 'l4';
    } else if (xp >= 100 || pCount >= 4) {
      levelClass = 'l3';
    } else if (xp >= 50 || pCount >= 2) {
      levelClass = 'l2';
    } else if (xp > 0 || pCount > 0 || tCount > 0) {
      levelClass = 'l1';
    }

    cells.push(`
      <div class="heatmap-cell ${levelClass}"
           data-date="${dStr}"
           data-xp="${xp}"
           data-pillars="${pCount}"
           data-tasks="${tCount}"
           title="${dStr}: +${xp} XP • ${pCount}/7 pilares • ${tCount} tareas">
      </div>
    `);

    curr.setDate(curr.getDate() + 1);
  }

  return {
    htmlCells: cells.join(''),
    earliestDate
  };
}

function attachStatsEventListeners(container) {
  // Refill Streak Freeze Shield
  const btnRefill = container.querySelector('#btn-refill-freeze-shield');
  if (btnRefill) {
    btnRefill.addEventListener('click', async () => {
      const res = await store.refillFreezeShield(FREEZE_SHIELD_COST_XP);
      if (res.success) {
        alert(`🛡️ ¡Escudo recargado exitosamente! Tienes ${res.freezeTokens}/${MAX_FREEZE_SHIELDS} escudos.`);
        renderStatsView(container);
      } else {
        alert(res.error);
      }
    });
  }

  // Activity search input
  const searchInput = container.querySelector('#stats-search-activities');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activitySearchQuery = e.target.value;
      renderStatsView(container);
    });
  }

  // Notification Toggle
  const btnToggleNotif = container.querySelector('#btn-toggle-notifications');
  if (btnToggleNotif) {
    btnToggleNotif.addEventListener('click', async () => {
      const active = await notificationEngine.toggleEnabled();
      if (active) {
        alert('🔔 ¡Notificaciones activadas!');
      } else {
        alert('🔕 Notificaciones desactivadas.');
      }
      renderStatsView(container);
    });
  }

  // Test Notification
  const btnTestNotif = container.querySelector('#btn-test-notification');
  if (btnTestNotif) {
    btnTestNotif.addEventListener('click', () => {
      notificationEngine.sendNotification('⚡ Prueba de Notificación Kizen', {
        body: '¡Las notificaciones están configuradas y funcionando correctamente!'
      });
    });
  }

  // Save Notification Schedule
  const btnSaveNotif = container.querySelector('#btn-save-notif-schedule');
  if (btnSaveNotif) {
    btnSaveNotif.addEventListener('click', () => {
      const dailyTime = container.querySelector('#input-daily-reminder-time').value;
      const weeklyDay = container.querySelector('#select-weekly-day').value;
      const weeklyTime = container.querySelector('#input-weekly-time').value;
      const monthlyDay = container.querySelector('#select-monthly-day').value;
      const monthlyTime = container.querySelector('#input-monthly-time').value;

      notificationEngine.saveSettings({
        dailyReminderEnabled: true,
        dailyReminderTime: dailyTime,
        weeklyReviewDay: weeklyDay,
        weeklyReviewTime: weeklyTime,
        monthlyReviewDay: monthlyDay,
        monthlyReviewTime: monthlyTime
      });

      alert('✅ Horarios de notificación guardados correctamente.');
    });
  }

  // Save CouchDB Sync
  const btnSaveSync = container.querySelector('#btn-save-couchdb-sync');
  if (btnSaveSync) {
    btnSaveSync.addEventListener('click', () => {
      const url = container.querySelector('#couchdb-url-input').value.trim();
      if (!url) {
        alert('Por favor ingresa una URL válida de CouchDB.');
        return;
      }
      const res = dbManager.connectRemote(url);
      if (res.success) {
        alert('¡Sincronización CouchDB iniciada!');
        renderStatsView(container);
      } else {
        alert('Error al conectar: ' + res.error);
      }
    });
  }

  // Disconnect CouchDB
  const btnDisconnect = container.querySelector('#btn-disconnect-couchdb-sync');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
      dbManager.disconnectRemote();
      alert('Sincronización remota desconectada.');
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

  // Restore Safety Snapshot
  const btnRestoreSnapshot = container.querySelector('#btn-restore-safety-snapshot');
  if (btnRestoreSnapshot) {
    btnRestoreSnapshot.addEventListener('click', async () => {
      if (confirm('¿Restaurar la última copia de seguridad automática (snapshot) guardada en este dispositivo?')) {
        const res = await dbManager.restoreSafetySnapshot();
        if (res.success) {
          alert(`¡${res.count} documentos restaurados exitosamente! Recargando datos...`);
          await store.loadInitialData();
          renderStatsView(container);
        } else {
          alert(res.error || 'No se pudo restaurar el snapshot.');
        }
      }
    });
  }

  // Heatmap Range Preset Buttons
  container.querySelectorAll('.btn-heatmap-range').forEach((btn) => {
    btn.addEventListener('click', () => {
      heatmapRangePreset = btn.dataset.range;
      renderStatsView(container);
    });
  });

  // Heatmap Cell Inspector (Hover & Tap)
  const inspector = container.querySelector('#heatmap-cell-inspector');
  if (inspector) {
    container.querySelectorAll('.heatmap-cell[data-date]').forEach((cell) => {
      const showInfo = () => {
        const d = cell.dataset.date;
        const xp = cell.dataset.xp || 0;
        const p = cell.dataset.pillars || 0;
        const t = cell.dataset.tasks || 0;
        inspector.innerHTML = `📅 <strong>${d}</strong> — <span style="color: var(--color-xp); font-weight: 800;">+${xp} XP</span> • 🏛️ <strong>${p}/7</strong> pilares • ✅ <strong>${t}</strong> tareas completadas`;
      };
      cell.addEventListener('mouseenter', showInfo);
      cell.addEventListener('click', showInfo);
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
          alert(`¡${res.count} documentos importados exitosamente! Recargando datos...`);
          await store.loadInitialData();
          renderStatsView(container);
        } else {
          alert('Error en importación: ' + res.error);
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

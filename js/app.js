/**
 * KIZEN MAIN APPLICATION CONTROLLER (js/app.js)
 * Coordinates SPA navigation, modals, toasts, global hotkeys, and PWA lifecycle.
 */

import { store } from './store.js';
import { dbManager } from './db.js';
import { calculateLevelData, BONUS_XP } from './gamification.js';
import { renderDailyView } from './views/dailyView.js';
import { renderWeeklyView } from './views/weeklyView.js';
import { renderMonthlyView } from './views/monthlyView.js';
import { renderProjectsView } from './views/projectsView.js';
import { renderJournalView } from './views/journalView.js';
import { renderStatsView } from './views/statsView.js';
import { notificationEngine } from './notifications.js';

let currentActiveView = 'daily';

// Capture Chrome PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPwaPrompt = e;
});

async function initApp() {
  // 1. Setup UI Navigation, Modals & Toasts immediately so buttons work instantly
  setupNavigation();
  setupModals();
  setupToastNotifications();

  // 2. Register Service Worker with forced update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        }
      });
    }).catch((err) => {
      console.warn('SW registration skipped:', err);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // 3. Initialize Store & Data safely
  try {
    await store.init();
    notificationEngine.initScheduler();
    setupHeaderStatus();
  } catch (err) {
    console.error('Error initializing store:', err);
  }

  // 4. Render active view
  switchView('daily');

  // 5. Store subscription
  store.subscribe((event, data) => {
    updateHeaderStatus();
    if (event === 'xp-gained') {
      if (data.amount > 0) {
        showToast(`⚡ +${data.amount} XP • ${data.reason || 'Actividad Registrada'}`, 'xp');
      }
    } else if (event === 'level-up') {
      showToast(`🎉 ¡SUBISTE DE NIVEL! Alcanzaste el Nivel ${data.newLevel} (${data.rankTitle})!`, 'level-up');
    } else if (event === 'combo-achieved') {
      showToast(`🔥 ¡COMBO 7/7 PILARES! ¡+50 XP Bonus Reclamado!`, 'level-up');
    } else if (event === 'shield-earned') {
      showToast(`🛡️ ¡+1 Escudo de Racha Ganado por hito semanal! (${data.freezeTokens} disponibles)`, 'xp');
    } else if (event === 'shield-refilled') {
      showToast(`🛡️ Escudo de racha recargado (${data.freezeTokens} disponibles)`, 'xp');
    }

    renderActiveView();
  });
}

// Bulletproof execution for both direct load and deferred module execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (targetView) {
        switchView(targetView);
      }
    });
  });

  // FAB Quick Capture
  const fab = document.querySelector('#fab-quick-capture');
  if (fab) {
    fab.addEventListener('click', () => {
      openModal('add-task');
    });
  }
}

function switchView(viewName) {
  currentActiveView = viewName;

  // Update Nav items active class
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Hide all view containers, show targeted view
  document.querySelectorAll('.view-container').forEach((vc) => {
    vc.classList.toggle('active', vc.id === `view-${viewName}`);
  });

  renderActiveView();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderActiveView() {
  const container = document.getElementById(`view-${currentActiveView}`);
  if (!container) return;

  switch (currentActiveView) {
    case 'daily':
      renderDailyView(container);
      break;
    case 'weekly':
      renderWeeklyView(container);
      break;
    case 'monthly':
      renderMonthlyView(container);
      break;
    case 'projects':
      renderProjectsView(container);
      break;
    case 'journal':
      renderJournalView(container);
      break;
    case 'stats':
      renderStatsView(container);
      break;
  }
}

function setupHeaderStatus() {
  updateHeaderStatus();

  dbManager.onSyncStatusChange((status) => {
    const syncPill = document.querySelector('#header-sync-pill');
    if (syncPill) {
      syncPill.className = `status-pill sync ${status}`;
      syncPill.innerHTML = status === 'online' ? '🟢 PC Synced' : status === 'syncing' ? '🔄 Syncing...' : '🟡 Local Mode';
    }
  });

  // Clicking level pill opens stats view
  const levelPill = document.querySelector('#header-level-pill');
  if (levelPill) {
    levelPill.addEventListener('click', () => switchView('stats'));
  }
}

function updateHeaderStatus() {
  const { profile } = store;
  if (!profile) return;

  const levelData = calculateLevelData(profile.totalXp);
  const streakPill = document.querySelector('#header-streak-pill');
  const levelPill = document.querySelector('#header-level-pill');

  if (streakPill) {
    streakPill.textContent = `🔥 ${profile.currentStreak || 0}`;
  }
  if (levelPill) {
    levelPill.textContent = `⭐ LVL ${levelData.level}`;
  }
}

// --- Global Modal Manager ---

function setupModals() {
  const overlay = document.querySelector('#modal-overlay');

  window.addEventListener('kizen-open-modal', (e) => {
    const modalType = e.detail?.modal;
    openModal(modalType, e.detail || {});
  });

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }
}

function openModal(modalType, modalDetail = {}) {
  const overlay = document.querySelector('#modal-overlay');
  const modalContent = document.querySelector('#modal-dynamic-content');
  if (!overlay || !modalContent) return;

  modalContent.innerHTML = getModalHtml(modalType, modalDetail);
  overlay.classList.add('active');

  attachModalHandlers(modalType, modalContent, modalDetail);
}

function closeModal() {
  const overlay = document.querySelector('#modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function getModalHtml(modalType, modalDetail = {}) {
  switch (modalType) {
    case 'add-task':
      const targetDate = modalDetail.prefilledDate || store.currentLogicalDate;
      return `
        <div class="modal-header">
          <div class="modal-title">⚡ Nueva Tarea / Acción</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Título de la Tarea</label>
          <input type="text" class="input-text" id="modal-task-title" placeholder="ej. Estudiar 30m gramática JLPT o Escribir informe" autofocus>
        </div>
        <div class="input-group">
          <label class="input-label">Fecha Programada</label>
          <input type="date" class="input-text" id="modal-task-date" value="${targetDate}">
        </div>
        <div class="input-group">
          <label class="input-label">Prioridad (Matriz Eisenhower)</label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;" id="modal-priority-selector">
            <label class="filter-chip" style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; border-color: rgba(239, 68, 68, 0.4);">
              <input type="radio" name="modal-priority" value="p1" style="display: none;">
              🔴 P1 Urgente
            </label>
            <label class="filter-chip active" style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; border-color: rgba(245, 158, 11, 0.4);">
              <input type="radio" name="modal-priority" value="p2" checked style="display: none;">
              🟡 P2 Importante
            </label>
            <label class="filter-chip" style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; border-color: rgba(56, 189, 248, 0.4);">
              <input type="radio" name="modal-priority" value="p3" style="display: none;">
              🔵 P3 Rutina
            </label>
            <label class="filter-chip" style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; border-color: rgba(255, 255, 255, 0.2);">
              <input type="radio" name="modal-priority" value="p4" style="display: none;">
              ⚪ P4 Backlog
            </label>
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">Dificultad & Recompensa XP</label>
          <select class="select" id="modal-task-difficulty">
            <option value="trivial">🟢 Trivial (+10 XP) - &lt; 5 mins</option>
            <option value="easy" selected>🔵 Fácil (+25 XP) - 15–30 mins</option>
            <option value="medium">🟡 Medio (+50 XP) - 45–90 mins</option>
            <option value="hard">🔴 Difícil (+100 XP) - 2–4 horas</option>
            <option value="epic">🟣 Épico (+250 XP) - Hito de todo el día</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Tags (click para seleccionar)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;" id="modal-tag-selector">
            ${store.customTags.map(t => `
              <label class="filter-chip" style="cursor: pointer;">
                <input type="checkbox" value="${t.label}" style="display: none;">
                ${t.label}
              </label>
            `).join('')}
          </div>
          <div style="display: flex; gap: 6px;">
            <input type="text" class="input-text input-sm" id="modal-quick-create-tag-input" placeholder="+ Crear nuevo tag... ej. #marketing" style="font-size: 0.78rem; padding: 6px 10px; flex: 1;">
            <button class="btn btn-sm btn-secondary" id="btn-modal-quick-create-tag" type="button" style="font-size: 0.75rem; padding: 6px 10px; white-space: nowrap;">+ Añadir</button>
          </div>
        </div>
        <div class="input-group" style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
          <input type="checkbox" id="modal-task-optional" style="width: 18px; height: 18px;">
          <label for="modal-task-optional" class="input-label" style="margin: 0; cursor: pointer;">
            Tarea Opcional / Bonus de Energía (Sin penalización)
          </label>
        </div>
        <button class="btn btn-primary" id="btn-submit-task" style="width: 100%; margin-top: 14px;">
          + Crear Tarea
        </button>
      `;

    case 'manage-tags':
      return `
        <div class="modal-header">
          <div class="modal-title">🏷️ Administrar Etiquetas (Tags)</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Nombre del nuevo tag</label>
          <input type="text" class="input-text" id="modal-new-tag-name" placeholder="ej. #marketing, #salud">
        </div>
        <button class="btn btn-primary" id="btn-submit-new-tag" style="width: 100%; margin-bottom: 16px;">
          + Añadir Tag
        </button>
        <div class="section-subtitle" style="margin-bottom: 8px;">Tags Existentes:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${store.customTags.map(t => `
            <div class="tag-badge" style="padding: 6px 10px; font-size: 0.8rem; display: flex; align-items: center; gap: 8px; background: ${t.color ? t.color + '22' : 'rgba(255,255,255,0.08)'}; color: ${t.color || 'var(--text-primary)'}; border: 1px solid ${t.color || 'var(--border-subtle)'};">
              <span style="font-weight: 600;">${t.label}</span>
              <button class="btn-delete-tag-btn" data-tag-id="${t.id}" style="background: none; border: none; color: var(--color-danger); cursor: pointer; font-size: 0.85rem; font-weight: bold; line-height: 1; padding: 0;" title="Eliminar etiqueta">✕</button>
            </div>
          `).join('')}
        </div>
      `;

    case 'add-weekly-goal':
      return `
        <div class="modal-header">
          <div class="modal-title">📅 Nuevo Objetivo Semanal (Sprint)</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Título del Objetivo</label>
          <input type="text" class="input-text" id="modal-goal-title" placeholder="ej. Completar Módulo de Autenticación (+150 XP)">
        </div>
        <div class="input-group">
          <label class="input-label">Criterio de Éxito / Descripción</label>
          <textarea class="textarea" id="modal-goal-desc" placeholder="¿Cómo sabrás que este sprint está cumplido?"></textarea>
        </div>
        <button class="btn btn-primary" id="btn-submit-weekly-goal" style="width: 100%; margin-top: 10px;">
          + Crear Objetivo Semanal
        </button>
      `;

    case 'add-monthly-goal':
      return `
        <div class="modal-header">
          <div class="modal-title">🗓️ Nuevo Objetivo Mensual (OKR)</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Título del Objetivo</label>
          <input type="text" class="input-text" id="modal-monthly-title" placeholder="ej. Dominar Gramática N4 o Lanzar MVP (+500 XP)">
        </div>
        <div class="input-group">
          <label class="input-label">Visión & Resultados Clave</label>
          <textarea class="textarea" id="modal-monthly-desc" placeholder="Metas e impacto esperado para este mes..."></textarea>
        </div>
        <button class="btn btn-primary" id="btn-submit-monthly-goal" style="width: 100%; margin-top: 10px;">
          + Crear Objetivo Mensual
        </button>
      `;

    case 'add-project':
      return `
        <div class="modal-header">
          <div class="modal-title">📁 Nuevo Proyecto</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Nombre del Proyecto</label>
          <input type="text" class="input-text" id="modal-project-name" placeholder="ej. Configuración de PWA y Servidor">
        </div>
        <div class="input-group">
          <label class="input-label">Categoría</label>
          <input type="text" class="input-text" id="modal-project-category" placeholder="ej. Aprendizaje, Código, Fitness, Trabajo">
        </div>
        <div class="input-group">
          <label class="input-label">Descripción</label>
          <textarea class="textarea" id="modal-project-desc" placeholder="Alcance general del proyecto..."></textarea>
        </div>
        <div class="input-group">
          <label class="input-label">Actividades Iniciales (separadas por coma)</label>
          <input type="text" class="input-text" id="modal-project-activities" placeholder="ej. Diseñar esquema, Implementar frontend, Pruebas">
        </div>
        <button class="btn btn-primary" id="btn-submit-project" style="width: 100%; margin-top: 10px;">
          + Crear Proyecto
        </button>
      `;

    case 'cascade-breakdown':
      const preselectedId = modalDetail.preselectedGoalId || '';
      const availableMonthly = store.monthlyGoals.filter(g => !g.isCompleted);

      return `
        <div class="modal-header">
          <div class="modal-title">🔨 Descomponer Objetivo Mensual</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">
          Descompón un objetivo mensual grande en <strong>1 objetivo semanal</strong> y <strong>acciones diarias concretas</strong> (+75 XP de bonificación).
        </p>

        <!-- Goal selection -->
        <div class="input-group">
          <label class="input-label">Objetivo Mensual a Descomponer:</label>
          <select class="select" id="modal-breakdown-goal-select">
            ${availableMonthly.length === 0 ? '<option value="">Sin objetivos mensuales activos</option>' : ''}
            ${availableMonthly.map(g => `
              <option value="${g._id}" ${g._id === preselectedId ? 'selected' : ''}>
                ${escapeHtml(g.title)}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Manual Decomposition Section -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 12px;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--color-primary); margin-bottom: 8px;">
            1. Hito Semanal Intermedio (Sprint):
          </div>
          <input type="text" class="input-text" id="modal-breakdown-weekly-title" 
            placeholder="ej. Sprint Semana 1: Esquema y componentes base" style="margin-bottom: 10px;">

          <div style="font-size: 0.82rem; font-weight: 700; color: var(--color-xp); margin-bottom: 8px;">
            2. Acciones Diarias Inmediatas (+XP):
          </div>

          <div class="breakdown-daily-tasks" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 6px;">
              <input type="text" class="input-text breakdown-task-title" placeholder="Paso 1: Configurar entorno y requisitos" style="flex: 2;">
              <select class="select breakdown-task-diff" style="flex: 1;">
                <option value="easy" selected>🔵 Fácil (+25)</option>
                <option value="medium">🟡 Medio (+50)</option>
                <option value="hard">🔴 Difícil (+100)</option>
              </select>
            </div>

            <div style="display: flex; gap: 6px;">
              <input type="text" class="input-text breakdown-task-title" placeholder="Paso 2: Desarrollar lógica principal" style="flex: 2;">
              <select class="select breakdown-task-diff" style="flex: 1;">
                <option value="medium" selected>🟡 Medio (+50)</option>
                <option value="easy">🔵 Fácil (+25)</option>
                <option value="hard">🔴 Difícil (+100)</option>
              </select>
            </div>

            <div style="display: flex; gap: 6px;">
              <input type="text" class="input-text breakdown-task-title" placeholder="Paso 3: Revisión, tests y pulido" style="flex: 2;">
              <select class="select breakdown-task-diff" style="flex: 1;">
                <option value="easy" selected>🔵 Fácil (+25)</option>
                <option value="medium">🟡 Medio (+50)</option>
                <option value="hard">🔴 Difícil (+100)</option>
              </select>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" id="btn-submit-manual-breakdown" style="flex: 2;">
            💾 Descomponer y Guardar (+75 XP)
          </button>
          <button class="btn btn-secondary" id="btn-quick-auto-breakdown" style="flex: 1;" title="Rellenar con propuesta automática">
            ✨ Auto-Llenar
          </button>
        </div>
      `;

    default:
      return '';
  }
}

function attachModalHandlers(modalType, modalContent, modalDetail = {}) {
  const btnClose = modalContent.querySelector('#btn-close-modal');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  if (modalType === 'add-task') {
    // Priority chip selection toggles
    modalContent.querySelectorAll('#modal-priority-selector .filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        modalContent.querySelectorAll('#modal-priority-selector .filter-chip').forEach(c => c.classList.remove('active'));
        const radio = chip.querySelector('input');
        if (radio) radio.checked = true;
        chip.classList.add('active');
      });
    });

    // Tag chip selection toggles
    modalContent.querySelectorAll('#modal-tag-selector .filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const checkbox = chip.querySelector('input');
        checkbox.checked = !checkbox.checked;
        chip.classList.toggle('active', checkbox.checked);
      });
    });

    // Quick tag creation inside modal
    const btnQuickAddTag = modalContent.querySelector('#btn-modal-quick-create-tag');
    const inputQuickTag = modalContent.querySelector('#modal-quick-create-tag-input');
    const handleQuickAddTag = async () => {
      if (!inputQuickTag || !inputQuickTag.value.trim()) return;
      const tagLabel = inputQuickTag.value.trim();
      const newTag = await store.addCustomTag(tagLabel);
      if (newTag) {
        const selector = modalContent.querySelector('#modal-tag-selector');
        if (selector) {
          const chip = document.createElement('label');
          chip.className = 'filter-chip active';
          chip.style.cursor = 'pointer';
          chip.innerHTML = `<input type="checkbox" value="${newTag.label}" checked style="display: none;"> ${newTag.label}`;
          chip.addEventListener('click', () => {
            const cb = chip.querySelector('input');
            cb.checked = !cb.checked;
            chip.classList.toggle('active', cb.checked);
          });
          selector.appendChild(chip);
        }
        inputQuickTag.value = '';
      }
    };
    if (btnQuickAddTag) btnQuickAddTag.addEventListener('click', handleQuickAddTag);
    if (inputQuickTag) {
      inputQuickTag.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleQuickAddTag();
        }
      });
    }

    const btnSubmit = modalContent.querySelector('#btn-submit-task');
    btnSubmit.addEventListener('click', async () => {
      const rawTitle = modalContent.querySelector('#modal-task-title').value;
      if (!rawTitle || !rawTitle.trim()) {
        alert('Por favor ingresa un título para la tarea.');
        return;
      }

      // Parse inline #tags and priority tokens (p1-p4)
      const parsed = store.parseTaskInput(rawTitle);
      for (const t of parsed.tags) {
        await store.addCustomTag(t);
      }

      const scheduledDate = modalContent.querySelector('#modal-task-date')?.value || store.currentLogicalDate;
      const difficulty = modalContent.querySelector('#modal-task-difficulty').value;
      const isOptional = modalContent.querySelector('#modal-task-optional').checked;
      const radioPriority = modalContent.querySelector('#modal-priority-selector input:checked')?.value;
      const finalPriority = (parsed.priority !== 'p2' && parsed.priority) ? parsed.priority : (radioPriority || 'p2');

      const checkedTags = Array.from(modalContent.querySelectorAll('#modal-tag-selector input:checked')).map(i => i.value);
      const allTags = Array.from(new Set([...checkedTags, ...parsed.tags]));

      await store.addTask({
        title: parsed.title,
        scheduledDate,
        difficulty,
        isOptional,
        priority: finalPriority,
        tags: allTags
      });

      closeModal();
      showToast(`Tarea agregada para ${scheduledDate}!`, 'xp');
    });
  } else if (modalType === 'manage-tags') {
    const btnAdd = modalContent.querySelector('#btn-submit-new-tag');
    btnAdd.addEventListener('click', async () => {
      const name = modalContent.querySelector('#modal-new-tag-name').value;
      if (name && name.trim()) {
        await store.addCustomTag(name);
        openModal('manage-tags');
      }
    });

    modalContent.querySelectorAll('.btn-delete-tag-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tagId = btn.dataset.tagId;
        await store.deleteCustomTag(tagId);
        openModal('manage-tags');
      });
    });
  } else if (modalType === 'add-weekly-goal') {
    const btnSubmit = modalContent.querySelector('#btn-submit-weekly-goal');
    btnSubmit.addEventListener('click', async () => {
      const title = modalContent.querySelector('#modal-goal-title').value;
      const description = modalContent.querySelector('#modal-goal-desc').value;
      if (title && title.trim()) {
        await store.addGoal({ period: 'weekly', title, description });
        closeModal();
        showToast('¡Objetivo semanal creado!', 'xp');
      }
    });
  } else if (modalType === 'add-monthly-goal') {
    const btnSubmit = modalContent.querySelector('#btn-submit-monthly-goal');
    btnSubmit.addEventListener('click', async () => {
      const title = modalContent.querySelector('#modal-monthly-title').value;
      const description = modalContent.querySelector('#modal-monthly-desc').value;
      if (title && title.trim()) {
        await store.addGoal({ period: 'monthly', title, description });
        closeModal();
        showToast('¡Objetivo mensual creado!', 'xp');
      }
    });
  } else if (modalType === 'add-project') {
    const btnSubmit = modalContent.querySelector('#btn-submit-project');
    btnSubmit.addEventListener('click', async () => {
      const name = modalContent.querySelector('#modal-project-name').value;
      const category = modalContent.querySelector('#modal-project-category').value;
      const description = modalContent.querySelector('#modal-project-desc').value;
      const actsRaw = modalContent.querySelector('#modal-project-activities').value;
      const activities = actsRaw.split(',').map(s => s.trim()).filter(Boolean);

      if (name && name.trim()) {
        await store.addProject({ name, category, description, activities });
        closeModal();
        showToast('¡Proyecto creado!', 'xp');
      }
    });
  } else if (modalType === 'cascade-breakdown') {
    // Auto fill proposal button
    const btnAuto = modalContent.querySelector('#btn-quick-auto-breakdown');
    if (btnAuto) {
      btnAuto.addEventListener('click', () => {
        const goalSelect = modalContent.querySelector('#modal-breakdown-goal-select');
        const selectedId = goalSelect.value;
        const goal = store.monthlyGoals.find(g => g._id === selectedId);
        const goalName = goal ? goal.title : 'Objetivo';

        modalContent.querySelector('#modal-breakdown-weekly-title').value = `[Sprint 1] Hito de Arranque: ${goalName}`;
        const taskInputs = modalContent.querySelectorAll('.breakdown-task-title');
        if (taskInputs[0]) taskInputs[0].value = `Investigación y preparación para ${goalName}`;
        if (taskInputs[1]) taskInputs[1].value = `Implementación del bloque principal de ${goalName}`;
        if (taskInputs[2]) taskInputs[2].value = `Verificación, pulido y entrega de ${goalName}`;
      });
    }

    // Submit Manual Breakdown
    const btnSubmitManual = modalContent.querySelector('#btn-submit-manual-breakdown');
    if (btnSubmitManual) {
      btnSubmitManual.addEventListener('click', async () => {
        const goalSelect = modalContent.querySelector('#modal-breakdown-goal-select');
        const selectedId = goalSelect.value;
        const weeklyTitle = modalContent.querySelector('#modal-breakdown-weekly-title').value.trim();
        const taskRows = modalContent.querySelectorAll('.breakdown-daily-tasks > div');

        let createdCount = 0;
        let weeklyGoalId = null;

        if (weeklyTitle) {
          const wGoal = await store.addGoal({
            period: 'weekly',
            title: weeklyTitle,
            parentMonthlyGoalId: selectedId || null
          });
          weeklyGoalId = wGoal._id;
          createdCount++;
        }

        for (const row of taskRows) {
          const title = row.querySelector('.breakdown-task-title')?.value.trim();
          const difficulty = row.querySelector('.breakdown-task-diff')?.value || 'easy';
          if (title) {
            await store.addTask({
              title,
              difficulty,
              scheduledDate: store.currentLogicalDate,
              weeklyGoalId,
              parentMonthlyGoalId: selectedId || null,
              tags: ['#desglose']
            });
            createdCount++;
          }
        }

        if (createdCount === 0) {
          alert('Por favor ingresa al menos un objetivo semanal o una tarea diaria.');
          return;
        }

        // Award Breakdown Bonus XP
        await store.addXp(BONUS_XP.BREAKDOWN_BONUS || 75, 'Desglose de Objetivo Mensual');

        closeModal();
        showToast('✨ ¡Objetivo desglosado con éxito! +75 XP otorgados.', 'level-up');
        switchView('daily');
      });
    }
  }
}

// --- Toast Notifications ---

function setupToastNotifications() {
  let toastBox = document.querySelector('#toast-container');
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.id = 'toast-container';
    toastBox.className = 'toast-container';
    document.body.appendChild(toastBox);
  }

  // Listen to custom notification event
  window.addEventListener('kizen-show-toast', (e) => {
    showToast(e.detail?.message || 'Notificación', e.detail?.type || 'info');
  });
}

function showToast(message, type = 'info') {
  const container = document.querySelector('#toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

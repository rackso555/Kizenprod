/**
 * KIZEN MAIN APPLICATION CONTROLLER (js/app.js)
 * Coordinates SPA navigation, modals, toasts, global hotkeys, and PWA lifecycle.
 */

import { store } from './store.js';
import { dbManager } from './db.js';
import { calculateLevelData, DIFFICULTY_XP } from './gamification.js';
import { renderDailyView } from './views/dailyView.js';
import { renderWeeklyView } from './views/weeklyView.js';
import { renderMonthlyView } from './views/monthlyView.js';
import { renderProjectsView } from './views/projectsView.js';
import { renderStatsView } from './views/statsView.js';
import { notificationEngine } from './notifications.js';

let currentActiveView = 'daily';

// Capture Chrome PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPwaPrompt = e;
});

document.addEventListener('DOMContentLoaded', async () => {
  // Register Service Worker for offline PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration skipped:', err);
    });
  }

  // Initialize Store, Database & Notifications
  await store.init();
  notificationEngine.initScheduler();

  // Setup UI Navigation & Modals
  setupNavigation();
  setupHeaderStatus();
  setupModals();
  setupToastNotifications();

  // Initial View Render
  switchView('daily');

  // Listen to store updates
  store.subscribe((event, data) => {
    updateHeaderStatus();
    if (event === 'xp-gained') {
      showToast(`⚡ +${data.amount} XP • ${data.reason || 'Activity Logged'}`, 'xp');
    } else if (event === 'level-up') {
      showToast(`🎉 LEVEL UP! You reached Level ${data.newLevel} (${data.rankTitle})!`, 'level-up');
    } else if (event === 'combo-achieved') {
      showToast(`🔥 7/7 PILLARS COMBO! +50 XP Bonus Awarded!`, 'level-up');
    }

    // Re-render current active view if appropriate
    renderActiveView();
  });
});

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
    streakPill.innerHTML = `🔥 ${profile.currentStreak || 0}`;
  }
  if (levelPill) {
    levelPill.innerHTML = `⭐ LVL ${levelData.level}`;
  }
}

// --- Global Modal Manager ---

function setupModals() {
  const overlay = document.querySelector('#modal-overlay');
  const modalContent = document.querySelector('#modal-dynamic-content');

  window.addEventListener('kizen-open-modal', (e) => {
    const modalType = e.detail?.modal;
    openModal(modalType);
  });

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }
}

function openModal(modalType) {
  const overlay = document.querySelector('#modal-overlay');
  const modalContent = document.querySelector('#modal-dynamic-content');
  if (!overlay || !modalContent) return;

  modalContent.innerHTML = getModalHtml(modalType);
  overlay.classList.add('active');

  attachModalHandlers(modalType, modalContent);
}

function closeModal() {
  const overlay = document.querySelector('#modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function getModalHtml(modalType) {
  switch (modalType) {
    case 'add-task':
      return `
        <div class="modal-header">
          <div class="modal-title">⚡ Add New Task</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Task Title</label>
          <input type="text" class="input-text" id="modal-task-title" placeholder="e.g. Write Chapter 3 or 30m Japanese vocab" autofocus>
        </div>
        <div class="input-group">
          <label class="input-label">Difficulty & XP Reward</label>
          <select class="select" id="modal-task-difficulty">
            <option value="trivial">🟢 Trivial (+10 XP) - &lt; 5 mins</option>
            <option value="easy" selected>🔵 Easy (+25 XP) - 15–30 mins</option>
            <option value="medium">🟡 Medium (+50 XP) - 45–90 mins</option>
            <option value="hard">🔴 Hard (+100 XP) - 2–4 hours</option>
            <option value="epic">🟣 Epic (+250 XP) - Full Day Milestone</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Tags (click to select)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="modal-tag-selector">
            ${store.customTags.map(t => `
              <label class="filter-chip" style="cursor: pointer;">
                <input type="checkbox" value="${t.label}" style="display: none;">
                ${t.label}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="input-group" style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
          <input type="checkbox" id="modal-task-optional" style="width: 18px; height: 18px;">
          <label for="modal-task-optional" class="input-label" style="margin: 0; cursor: pointer;">
            Optional / Energy Bonus Task (No penalty if skipped)
          </label>
        </div>
        <button class="btn btn-primary" id="btn-submit-task" style="width: 100%; margin-top: 14px;">
          + Create Task
        </button>
      `;

    case 'manage-tags':
      return `
        <div class="modal-header">
          <div class="modal-title">🏷️ Manage Custom Tags</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">New Tag Name</label>
          <input type="text" class="input-text" id="modal-new-tag-name" placeholder="e.g. #marketing, #health">
        </div>
        <button class="btn btn-primary" id="btn-submit-new-tag" style="width: 100%; margin-bottom: 16px;">
          + Add Tag
        </button>
        <div class="section-subtitle" style="margin-bottom: 8px;">Existing Tags:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${store.customTags.map(t => `
            <div class="tag-badge" style="padding: 6px 10px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
              <span>${t.label}</span>
              <button class="btn-delete-tag-btn" data-tag-id="${t.id}" style="background: none; border: none; color: var(--color-danger); cursor: pointer;">✕</button>
            </div>
          `).join('')}
        </div>
      `;

    case 'add-weekly-goal':
      return `
        <div class="modal-header">
          <div class="modal-title">📅 Add Weekly Sprint Goal</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Goal Title</label>
          <input type="text" class="input-text" id="modal-goal-title" placeholder="e.g. Build PWA sync feature (+150 XP)">
        </div>
        <div class="input-group">
          <label class="input-label">Description / Success Criteria</label>
          <textarea class="textarea" id="modal-goal-desc" placeholder="What does completion look like?"></textarea>
        </div>
        <button class="btn btn-primary" id="btn-submit-weekly-goal" style="width: 100%; margin-top: 10px;">
          + Create Weekly Goal
        </button>
      `;

    case 'add-monthly-goal':
      return `
        <div class="modal-header">
          <div class="modal-title">🗓️ Add Monthly Objective (OKR)</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Objective Title</label>
          <input type="text" class="input-text" id="modal-monthly-title" placeholder="e.g. Master JLPT N4 Grammar (+500 XP)">
        </div>
        <div class="input-group">
          <label class="input-label">Vision & Key Results</label>
          <textarea class="textarea" id="modal-monthly-desc" placeholder="Target milestones for the month..."></textarea>
        </div>
        <button class="btn btn-primary" id="btn-submit-monthly-goal" style="width: 100%; margin-top: 10px;">
          + Create Monthly Objective
        </button>
      `;

    case 'add-project':
      return `
        <div class="modal-header">
          <div class="modal-title">📁 New Project Tree</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <div class="input-group">
          <label class="input-label">Project Name</label>
          <input type="text" class="input-text" id="modal-project-name" placeholder="e.g. Build Mobile Workstation">
        </div>
        <div class="input-group">
          <label class="input-label">Category</label>
          <input type="text" class="input-text" id="modal-project-category" placeholder="e.g. Learning, Tech, Fitness, Work">
        </div>
        <div class="input-group">
          <label class="input-label">Description</label>
          <textarea class="textarea" id="modal-project-desc" placeholder="High-level project scope..."></textarea>
        </div>
        <div class="input-group">
          <label class="input-label">Initial Activities (comma separated)</label>
          <input type="text" class="input-text" id="modal-project-activities" placeholder="e.g. Research specs, Order parts, Assemble hardware">
        </div>
        <button class="btn btn-primary" id="btn-submit-project" style="width: 100%; margin-top: 10px;">
          + Create Project
        </button>
      `;

    case 'cascade-breakdown':
      return `
        <div class="modal-header">
          <div class="modal-title">⚡ Cascading Goal Breakdown Helper</div>
          <button class="btn btn-icon btn-ghost" id="btn-close-modal">✕</button>
        </div>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">
          Select a goal to automatically generate 3 actionable daily tasks and eliminate friction!
        </p>
        <div class="input-group">
          <label class="input-label">Select Goal to Deconstruct</label>
          <select class="select" id="modal-cascade-select">
            ${store.weeklyGoals.map(g => `<option value="${g._id}">[Weekly] ${g.title}</option>`).join('')}
            ${store.monthlyGoals.map(g => `<option value="${g._id}">[Monthly] ${g.title}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-xp" id="btn-submit-cascade-generate" style="width: 100%; margin-top: 12px;">
          ✨ Generate 3 Daily Action Steps (+XP)
        </button>
      `;

    default:
      return '';
  }
}

function attachModalHandlers(modalType, modalContent) {
  const btnClose = modalContent.querySelector('#btn-close-modal');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  if (modalType === 'add-task') {
    // Tag chip selection toggles
    modalContent.querySelectorAll('#modal-tag-selector .filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const checkbox = chip.querySelector('input');
        checkbox.checked = !checkbox.checked;
        chip.classList.toggle('active', checkbox.checked);
      });
    });

    const btnSubmit = modalContent.querySelector('#btn-submit-task');
    btnSubmit.addEventListener('click', async () => {
      const title = modalContent.querySelector('#modal-task-title').value;
      if (!title || !title.trim()) {
        alert('Please enter a task title.');
        return;
      }
      const difficulty = modalContent.querySelector('#modal-task-difficulty').value;
      const isOptional = modalContent.querySelector('#modal-task-optional').checked;
      const selectedTags = Array.from(modalContent.querySelectorAll('#modal-tag-selector input:checked')).map(i => i.value);

      await store.addTask({
        title,
        difficulty,
        isOptional,
        tags: selectedTags
      });

      closeModal();
      showToast('Task added to Today!', 'xp');
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
        showToast('Weekly goal added!', 'xp');
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
        showToast('Monthly objective created!', 'xp');
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
        showToast('Project created!', 'xp');
      }
    });
  } else if (modalType === 'cascade-breakdown') {
    const btnSubmit = modalContent.querySelector('#btn-submit-cascade-generate');
    btnSubmit.addEventListener('click', async () => {
      const goalSelect = modalContent.querySelector('#modal-cascade-select');
      const selectedId = goalSelect.value;
      const goal = [...store.weeklyGoals, ...store.monthlyGoals].find(g => g._id === selectedId);
      const title = goal ? goal.title : 'Goal Breakdown';

      // Automatically generate 3 progressive action steps
      await store.addTask({
        title: `[Step 1] Initial Setup & Outline for: ${title}`,
        difficulty: 'easy',
        tags: ['#breakdown']
      });
      await store.addTask({
        title: `[Step 2] Core Execution Block for: ${title}`,
        difficulty: 'medium',
        tags: ['#breakdown']
      });
      await store.addTask({
        title: `[Step 3] Review & Polish: ${title}`,
        difficulty: 'easy',
        tags: ['#breakdown']
      });

      closeModal();
      showToast('✨ 3 Daily Actions generated in Daily list!', 'xp');
      switchView('daily');
    });
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
  }, 3000);
}

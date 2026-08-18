/**
 * DAILY COMMAND CENTER VIEW (js/views/dailyView.js)
 * Features 7 Daily Pillars, Active Project integration, Level Hero, Action items with Difficulty XP, and Journaling.
 */

import { store } from '../store.js';
import {
  calculateLevelData,
  formatDisplayDate,
  DIFFICULTY_XP
} from '../gamification.js';

export function renderDailyView(container) {
  const { profile, dailyLog, tasks, projects, customTags, currentLogicalDate } = store;
  if (!profile || !dailyLog) {
    container.innerHTML = '<div class="card">Loading Daily Command Center...</div>';
    return;
  }

  const levelData = calculateLevelData(profile.totalXp);
  const completedPillarsCount = dailyLog.pillarsCompleted?.length || 0;
  const totalPillarsCount = profile.pillars.length;
  const isAllPillarsCompleted = completedPillarsCount === totalPillarsCount;

  const activeProj = store.getActiveProject();
  const activeProjActivities = activeProj?.activities || [];

  // Filter tasks for today
  const todayTasks = tasks.filter(
    (t) => (t.scheduledDate === currentLogicalDate || !t.scheduledDate) && !t.isOptional
  );
  const optionalTasks = tasks.filter(
    (t) => (t.scheduledDate === currentLogicalDate || !t.scheduledDate) && t.isOptional
  );
  const rolloverTasks = tasks.filter(
    (t) => t.scheduledDate && t.scheduledDate < currentLogicalDate && !t.isCompleted
  );

  const nextSuggested = store.getSuggestedNextTask();

  container.innerHTML = `
    <!-- Top Level Hero Card -->
    <div class="level-hero-card">
      <div class="level-hero-top">
        <div class="level-title-group">
          <span class="level-badge-large">LVL ${levelData.level}</span>
          <span class="level-rank-name">${levelData.rankTitle}</span>
        </div>
        <div class="level-streak-badge">
          🔥 ${profile.currentStreak || 0} Day Streak
        </div>
      </div>
      <div class="xp-progress-wrapper">
        <div class="xp-label-row">
          <span>${levelData.xpIntoCurrentLevel} / ${levelData.xpNeededForNextLevel} XP</span>
          <span>Total: ${profile.totalXp} XP (${levelData.progressPercent}%)</span>
        </div>
        <div class="xp-progress-bar">
          <div class="xp-progress-fill" style="width: ${levelData.progressPercent}%;"></div>
        </div>
      </div>
    </div>

    <!-- Active Focus & "Pull Next Task" Banner -->
    <div class="focus-objective-card">
      <div class="focus-objective-header">
        <span class="focus-tag">⚡ Current Focus</span>
        <button class="btn btn-sm btn-secondary" id="btn-pull-next-task">
          🎯 Pull Next Task
        </button>
      </div>
      <div class="focus-objective-text" id="focus-task-display">
        ${nextSuggested ? nextSuggested.title : 'All primary targets clear! Add a task or pull from projects.'}
      </div>
    </div>

    <!-- 7 Daily Pillars Section -->
    <div class="section-header">
      <div class="section-title">
        <span>🏛️ The 7 Daily Pillars</span>
        <span class="section-subtitle">(${completedPillarsCount}/${totalPillarsCount})</span>
      </div>
      <span class="section-subtitle">5:00 AM Reset</span>
    </div>

    ${isAllPillarsCompleted ? `
      <div class="pillar-combo-card">
        <div class="combo-text">
          ✨ 7/7 Pillars Mastered! +50 XP Combo Claimed!
        </div>
      </div>
    ` : ''}

    <div class="pillars-grid" id="pillars-grid-container">
      ${profile.pillars.map((pillar) => {
        const isDone = dailyLog.pillarsCompleted.includes(pillar.id);
        return `
          <div class="pillar-card ${isDone ? 'completed' : ''}" data-pillar-id="${pillar.id}">
            <div class="pillar-info">
              <span class="pillar-icon">${pillar.icon}</span>
              <div class="pillar-text-group">
                <span class="pillar-name">${pillar.name}</span>
                <span class="pillar-subtext" title="${pillar.subtext}">${pillar.subtext}</span>
              </div>
            </div>
            <div class="pillar-check-box">
              ${isDone ? '✓' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Active Project Daily Activities Drawer -->
    ${activeProj ? `
      <div class="card" style="background: linear-gradient(135deg, #101c2e 0%, #13243a 100%); border-color: rgba(56, 189, 248, 0.3); margin-top: 10px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--color-primary);">💻 Focus Project:</span>
            <select class="select" id="daily-select-active-project" style="padding: 2px 8px; font-size: 0.8rem; width: auto; background: var(--bg-surface);">
              ${projects.map((p) => `<option value="${p._id}" ${p._id === activeProj._id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">
            ${activeProjActivities.filter(a => a.isCompleted).length}/${activeProjActivities.length} Done
          </span>
        </div>

        <div class="task-list" style="margin-bottom: 0;">
          ${activeProjActivities.length === 0 ? `
            <div style="font-size: 0.78rem; color: var(--text-muted);">No activities in this project. Add some in the Projects tab!</div>
          ` : activeProjActivities.map((act) => `
            <div class="task-item ${act.isCompleted ? 'completed' : ''}" style="padding: 8px 10px;">
              <div class="task-checkbox ${act.isCompleted ? 'checked' : ''} btn-toggle-daily-activity" 
                   data-project-id="${activeProj._id}" data-activity-id="${act.id}">
                ${act.isCompleted ? '✓' : ''}
              </div>
              <div class="task-body">
                <div class="task-title" style="font-size: 0.85rem;">${escapeHtml(act.title)}</div>
              </div>
              <span class="tag-badge" style="color: var(--color-xp); font-size: 0.7rem;">+30 XP</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Yesterday's Rollover Tasks (if any) -->
    ${rolloverTasks.length > 0 ? `
      <div class="rollover-card">
        <div class="rollover-header">
          <span>⏳ Yesterday's Incomplete Tasks (${rolloverTasks.length})</span>
        </div>
        <div class="task-list" style="margin-top: 8px;">
          ${rolloverTasks.map((task) => `
            <div class="task-item" style="border-style: dashed;">
              <div class="task-body">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-meta-row">
                  <span class="difficulty-pill ${task.difficulty}">+${task.xpAwarded} XP</span>
                </div>
              </div>
              <div class="task-actions">
                <button class="btn btn-sm btn-primary btn-rollover-today" data-task-id="${task._id}">
                  Do Today
                </button>
                <button class="btn btn-sm btn-ghost btn-delete-task" data-task-id="${task._id}">
                  ✕
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Seamless Task Action Toolbar & Filter -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; margin-bottom: 10px;">
      <div class="tag-filter-bar" id="tag-filter-bar" style="margin-bottom: 0; padding-bottom: 0; flex: 1;">
        <button class="filter-chip active" data-tag="all">All</button>
        ${customTags.map((tag) => `
          <button class="filter-chip" data-tag="${tag.id}" style="--tag-color: ${tag.color};">
            ${tag.label}
          </button>
        `).join('')}
        <button class="filter-chip" id="btn-manage-tags" style="border-style: dashed;">
          + Tag
        </button>
      </div>
      <button class="btn btn-sm btn-primary" id="btn-open-add-task" style="white-space: nowrap; flex-shrink: 0;">
        + Add Action
      </button>
    </div>

    <!-- Task List Container -->
    <div class="task-list" id="daily-task-list">
      ${todayTasks.length === 0 ? `
        <div class="card" style="text-align: center; color: var(--text-secondary); padding: 24px;">
          No active tasks scheduled for today. Tap <strong>+ Add Action</strong> or <strong>Pull Next Task</strong> to begin!
        </div>
      ` : todayTasks.map((task) => renderTaskItem(task)).join('')}
    </div>

    <!-- Optional / Bonus Tasks Tray -->
    ${optionalTasks.length > 0 ? `
      <details class="card" style="margin-top: 14px; cursor: pointer;">
        <summary style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">
          🎁 Optional / Energy Bonus Tasks (${optionalTasks.length})
        </summary>
        <div class="task-list" style="margin-top: 10px;">
          ${optionalTasks.map((task) => renderTaskItem(task)).join('')}
        </div>
      </details>
    ` : ''}

    <!-- Evening Reflection & Micro-Journaling -->
    <div class="journal-card">
      <div class="section-title" style="margin-bottom: 10px;">
        <span>📖 Evening Reflection & Gratitude</span>
        <span class="tag-badge" style="color: var(--color-xp);">+25 XP</span>
      </div>
      
      <div class="input-group">
        <label class="input-label">Today I'm grateful for (1-3 lines):</label>
        <div class="gratitude-row">
          <span class="gratitude-num">1.</span>
          <input type="text" class="input-text gratitude-input" data-index="0" 
            placeholder="A small win, person, or moment..." value="${escapeHtml(dailyLog.gratitudeItems?.[0] || '')}">
        </div>
        <div class="gratitude-row">
          <span class="gratitude-num">2.</span>
          <input type="text" class="input-text gratitude-input" data-index="1" 
            placeholder="Something that made today easier..." value="${escapeHtml(dailyLog.gratitudeItems?.[1] || '')}">
        </div>
        <div class="gratitude-row">
          <span class="gratitude-num">3.</span>
          <input type="text" class="input-text gratitude-input" data-index="2" 
            placeholder="A lesson or pleasant surprise..." value="${escapeHtml(dailyLog.gratitudeItems?.[2] || '')}">
        </div>
      </div>

      <div class="input-group">
        <label class="input-label">Micro-Journal (2-5 lines):</label>
        <textarea class="textarea" id="daily-journal-input" placeholder="What went well today? What will I adjust tomorrow?">${escapeHtml(dailyLog.journalText || '')}</textarea>
      </div>

      <button class="btn btn-secondary" id="btn-save-journal" style="width: 100%;">
        💾 Save Reflection & Claim XP
      </button>
    </div>
  `;

  attachDailyEventListeners(container);
}

function renderTaskItem(task) {
  return `
    <div class="task-item ${task.isCompleted ? 'completed' : ''}" data-task-id="${task._id}">
      <div class="task-checkbox ${task.isCompleted ? 'checked' : ''}" data-task-id="${task._id}">
        ${task.isCompleted ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta-row">
          <span class="difficulty-pill ${task.difficulty}">+${task.xpAwarded} XP</span>
          ${(task.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}
          ${task.dueDate ? `<span class="tag-badge">📅 ${task.dueDate}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-icon btn-ghost btn-delete-task" data-task-id="${task._id}" title="Delete">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function attachDailyEventListeners(container) {
  // Toggle Pillar Cards
  container.querySelectorAll('.pillar-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const pillarId = card.dataset.pillarId;
      await store.togglePillar(pillarId);
      renderDailyView(container);
    });
  });

  // Switch Active Project from dropdown
  const projSelect = container.querySelector('#daily-select-active-project');
  if (projSelect) {
    projSelect.addEventListener('change', async (e) => {
      await store.setActiveProject(e.target.value);
      renderDailyView(container);
    });
  }

  // Toggle Daily Activity from Active Project drawer
  container.querySelectorAll('.btn-toggle-daily-activity').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projId = btn.dataset.projectId;
      const actId = btn.dataset.activityId;
      await store.toggleActivityComplete(projId, actId);
      renderDailyView(container);
    });
  });

  // Pull Next Task Button
  const btnPull = container.querySelector('#btn-pull-next-task');
  if (btnPull) {
    btnPull.addEventListener('click', () => {
      const next = store.getSuggestedNextTask();
      const display = container.querySelector('#focus-task-display');
      if (next) {
        display.innerHTML = `<strong>Active Target:</strong> ${escapeHtml(next.title)}`;
      } else {
        display.innerText = 'No pending tasks found! Add a new task below.';
      }
    });
  }

  // Toggle Task Completion
  container.querySelectorAll('.task-checkbox:not(.btn-toggle-daily-activity)').forEach((box) => {
    box.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = box.dataset.taskId;
      await store.toggleTask(taskId);
      renderDailyView(container);
    });
  });

  // Delete Task
  container.querySelectorAll('.btn-delete-task').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      if (confirm('Delete this task?')) {
        await store.deleteTask(taskId);
        renderDailyView(container);
      }
    });
  });

  // Rollover Task to Today
  container.querySelectorAll('.btn-rollover-today').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      await store.rolloverTaskToToday(taskId);
      renderDailyView(container);
    });
  });

  // Save Reflection & Journal
  const btnSaveJournal = container.querySelector('#btn-save-journal');
  if (btnSaveJournal) {
    btnSaveJournal.addEventListener('click', async () => {
      const journalText = container.querySelector('#daily-journal-input').value;
      const gratitudeInputs = Array.from(container.querySelectorAll('.gratitude-input')).map((i) => i.value.trim());
      await store.saveReflection(journalText, gratitudeInputs);
      alert('Reflection and gratitude saved! Mindfulness XP awarded.');
      renderDailyView(container);
    });
  }

  // Tag filter chip toggles
  container.querySelectorAll('.filter-chip[data-tag]').forEach((chip) => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const tag = chip.dataset.tag;
      filterTaskList(container, tag);
    });
  });

  // Add Task Button
  const btnAddTask = container.querySelector('#btn-open-add-task');
  if (btnAddTask) {
    btnAddTask.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'add-task' } }));
    });
  }

  // Manage Tags Button
  const btnManageTags = container.querySelector('#btn-manage-tags');
  if (btnManageTags) {
    btnManageTags.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'manage-tags' } }));
    });
  }
}

function filterTaskList(container, tagId) {
  const items = container.querySelectorAll('#daily-task-list .task-item');
  items.forEach((item) => {
    if (tagId === 'all') {
      item.style.display = 'flex';
    } else {
      const tagBadges = item.querySelectorAll('.tag-badge');
      const hasTag = Array.from(tagBadges).some((b) => b.innerText.toLowerCase().includes(tagId));
      item.style.display = hasTag ? 'flex' : 'none';
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

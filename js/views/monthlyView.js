/**
 * MONTHLY VIEW & VISION OBJECTIVES (js/views/monthlyView.js)
 * Manages monthly OKRs, monthly milestone deconstruction, and big-picture alignment.
 */

import { store } from '../store.js';

export function renderMonthlyView(container) {
  const { monthlyGoals } = store;
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>🗓️ ${monthName} ${year}</h1>
        <div class="section-subtitle">Monthly Objectives & Vision</div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-add-monthly-goal">
        + Monthly Objective
      </button>
    </div>

    <!-- Monthly Vision Card -->
    <div class="card" style="background: linear-gradient(135deg, #161e31 0%, #1a2640 100%); border-color: rgba(99, 102, 241, 0.3);">
      <div class="section-title" style="color: #a5b4fc; margin-bottom: 6px;">
        <span>🎯 Monthly North Star</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
        Focus on 2–4 high-impact milestones that shape this month. These cascade directly into weekly sprints and daily tasks.
      </p>
    </div>

    <!-- Cascading Breakdown Assistant in Monthly -->
    <div class="cascade-assistant-card">
      <div class="cascade-header">
        <span class="cascade-title">⚡ Goal-to-Daily Cascading Helper</span>
        <button class="btn btn-sm btn-xp" id="btn-open-cascade-modal">
          🔨 Break Down Goal
        </button>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">
        Deconstruct any monthly objective into weekly sprint milestones and actionable daily tasks (+XP).
      </p>
      <div class="cascade-tree">
        <div class="cascade-node monthly">
          <span class="cascade-level-badge">Monthly</span>
          <span>Vision & Major Milestones</span>
        </div>
        <div class="cascade-node weekly">
          <span class="cascade-level-badge">Weekly</span>
          <span>1-3 Key Weekly Outcomes</span>
        </div>
        <div class="cascade-node daily">
          <span class="cascade-level-badge">Daily</span>
          <span>Concrete 15-45m Actions (+XP)</span>
        </div>
      </div>
    </div>

    <!-- Monthly Goals List -->
    <div class="section-title" style="margin-bottom: 12px;">
      <span>🏆 Objectives (${monthlyGoals.filter(g => g.isCompleted).length}/${monthlyGoals.length})</span>
    </div>

    <div class="goals-grid">
      ${monthlyGoals.length === 0 ? `
        <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 24px;">
          No monthly objectives set yet. Add a high-level milestone to guide your weeks!
        </div>
      ` : monthlyGoals.map((goal) => renderMonthlyGoalCard(goal)).join('')}
    </div>

    <!-- Monthly Calendar Preview -->
    <div class="card" style="margin-top: 20px;">
      <div class="section-title" style="margin-bottom: 12px;">
        <span>📅 ${monthName} Cadence</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center; font-size: 0.75rem;">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span style="font-weight: 700; color: var(--text-muted);">${d}</span>`).join('')}
        ${Array.from({ length: 30 }, (_, i) => {
          const dayNum = i + 1;
          const isPast = dayNum < now.getDate();
          const isToday = dayNum === now.getDate();
          return `
            <div style="
              padding: 8px 4px;
              border-radius: var(--radius-sm);
              background: ${isToday ? 'var(--color-primary)' : isPast ? 'var(--bg-surface-elevated)' : 'rgba(255,255,255,0.03)'};
              color: ${isToday ? 'var(--text-inverse)' : 'var(--text-primary)'};
              font-weight: ${isToday ? '800' : '600'};
            ">
              ${dayNum}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  attachMonthlyEventListeners(container);
}

function renderMonthlyGoalCard(goal) {
  return `
    <div class="goal-card ${goal.isCompleted ? 'completed' : ''}" data-goal-id="${goal._id}">
      <div class="goal-top">
        <div>
          <div class="goal-title">${escapeHtml(goal.title)}</div>
          ${goal.description ? `<p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(goal.description)}</p>` : ''}
        </div>
        <span class="tag-badge" style="color: var(--color-xp);">+500 XP</span>
      </div>

      <div class="goal-progress-section">
        <div class="goal-progress-row">
          <span>Target Progress</span>
          <span>${goal.isCompleted ? 'Achieved (100%)' : 'In Progress'}</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${goal.isCompleted ? 100 : 40}%; background: #818cf8;"></div>
        </div>
      </div>

      <div class="goal-actions">
        <button class="btn btn-sm ${goal.isCompleted ? 'btn-secondary' : 'btn-primary'} btn-toggle-monthly-goal" data-goal-id="${goal._id}">
          ${goal.isCompleted ? '✓ Completed' : 'Mark Achieved'}
        </button>
        <button class="btn btn-icon btn-ghost btn-delete-monthly-goal" data-goal-id="${goal._id}">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function attachMonthlyEventListeners(container) {
  const btnAdd = container.querySelector('#btn-add-monthly-goal');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'add-monthly-goal' } }));
    });
  }

  const btnCascade = container.querySelector('#btn-open-cascade-modal');
  if (btnCascade) {
    btnCascade.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'cascade-breakdown' } }));
    });
  }

  container.querySelectorAll('.btn-toggle-monthly-goal').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const goalId = btn.dataset.goalId;
      await store.toggleGoalComplete(goalId);
      renderMonthlyView(container);
    });
  });

  container.querySelectorAll('.btn-delete-monthly-goal').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const goalId = btn.dataset.goalId;
      if (confirm('Delete this monthly objective?')) {
        await store.deleteGoal(goalId);
        renderMonthlyView(container);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

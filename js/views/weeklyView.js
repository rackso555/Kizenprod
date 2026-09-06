/**
 * WEEKLY VIEW & CASCADING SPRINT ENGINE (js/views/weeklyView.js)
 * Manages weekly sprint goals, active focus project progress, and weekly velocity charts.
 */

import { store } from '../store.js';

export function renderWeeklyView(container) {
  const { weeklyGoals, projects } = store;
  const currentWeekNumber = getWeekNumber(new Date());
  const activeProj = store.getActiveProject();
  const activeProjActivities = activeProj?.activities || [];
  const completedActs = activeProjActivities.filter(a => a.isCompleted).length;
  const totalActs = activeProjActivities.length;
  const projProgress = totalActs > 0 ? Math.round((completedActs / totalActs) * 100) : 0;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>📅 Weekly Sprints</h1>
        <div class="section-subtitle">Week ${currentWeekNumber} Objectives & Sprints</div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-add-weekly-goal">
        + Weekly Goal
      </button>
    </div>

    <!-- Active Project Sprint Focus Card -->
    ${activeProj ? `
      <div class="card" style="background: linear-gradient(135deg, #101c2e 0%, #13243a 100%); border-color: rgba(56, 189, 248, 0.35); margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.05em;">
              🌟 Active Sprint Focus Project
            </div>
            <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
              ${escapeHtml(activeProj.name)}
            </div>
          </div>
          <span class="tag-badge" style="background: rgba(56, 189, 248, 0.15); color: var(--color-primary);">
            ${escapeHtml(activeProj.category)}
          </span>
        </div>

        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 10px;">
          ${escapeHtml(activeProj.description || 'No description.')}
        </p>

        <div>
          <div class="goal-progress-row">
            <span>Milestones: ${completedActs}/${totalActs}</span>
            <span>${projProgress}%</span>
          </div>
          <div class="goal-progress-bar" style="margin-top: 4px; margin-bottom: 12px;">
            <div class="goal-progress-fill" style="width: ${projProgress}%;"></div>
          </div>
        </div>

        <div class="task-list" style="margin-bottom: 0;">
          ${activeProjActivities.length === 0 ? `
            <div style="font-size: 0.78rem; color: var(--text-muted);">No milestones added yet. Add activities in the Projects tab!</div>
          ` : activeProjActivities.map((act) => `
            <div class="task-item ${act.isCompleted ? 'completed' : ''}" style="padding: 8px 10px;">
              <div class="task-checkbox ${act.isCompleted ? 'checked' : ''} btn-toggle-weekly-activity" 
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

    <!-- Weekly Goals List -->
    <div class="section-title" style="margin-bottom: 12px;">
      <span>🎯 Sprint Goals (${weeklyGoals.filter(g => g.isCompleted).length}/${weeklyGoals.length})</span>
    </div>

    <div class="goals-grid">
      ${weeklyGoals.length === 0 ? `
        <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 24px;">
          No weekly goals set yet. Set 1–3 high-impact outcomes for this sprint!
        </div>
      ` : weeklyGoals.map((goal) => renderGoalCard(goal)).join('')}
    </div>

    <!-- Weekly Velocity Bar Chart -->
    <div class="velocity-chart-wrapper">
      <div class="section-title">
        <span>📊 Weekly Velocity</span>
      </div>
      <div class="weekly-bars">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
          const isToday = (new Date().getDay() + 6) % 7 === i;
          const simulatedHeight = Math.min(100, Math.max(15, (i + 1) * 14));
          return `
            <div class="day-bar-col">
              <span class="day-bar-points">+${simulatedHeight * 2}</span>
              <div class="day-bar-fill-track">
                <div class="day-bar-fill ${isToday ? 'today' : ''}" style="height: ${simulatedHeight}%;"></div>
              </div>
              <span class="day-bar-label">${day}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Weekly Retrospective -->
    <div class="card">
      <div class="section-title" style="margin-bottom: 8px;">
        <span>📝 Retrospectiva Semanal</span>
        <span class="tag-badge" style="color: var(--color-xp);">+50 XP</span>
      </div>
      <div class="input-group">
        <label class="input-label">Victorias & Aprendizajes Clave de la Semana ${currentWeekNumber}:</label>
        <textarea class="textarea" id="input-weekly-retrospective" placeholder="¿Qué movió la aguja esta semana? ¿Qué ajustarás para el próximo sprint?">${escapeHtml(localStorage.getItem('kizen_weekly_review_week_' + currentWeekNumber) || '')}</textarea>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-save-weekly-retrospective">💾 Guardar Revisión Semanal</button>
    </div>
  `;

  attachWeeklyEventListeners(container);
}

function renderGoalCard(goal) {
  return `
    <div class="goal-card ${goal.isCompleted ? 'completed' : ''}" data-goal-id="${goal._id}">
      <div class="goal-top">
        <div>
          <div class="goal-title">${escapeHtml(goal.title)}</div>
          ${goal.description ? `<p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(goal.description)}</p>` : ''}
        </div>
        <span class="tag-badge" style="color: var(--color-xp);">+150 XP</span>
      </div>

      <div class="goal-progress-section">
        <div class="goal-progress-row">
          <span>Status</span>
          <span>${goal.isCompleted ? 'Completed (100%)' : 'In Progress'}</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${goal.isCompleted ? 100 : 35}%;"></div>
        </div>
      </div>

      <div class="goal-actions">
        <button class="btn btn-sm ${goal.isCompleted ? 'btn-secondary' : 'btn-primary'} btn-toggle-goal" data-goal-id="${goal._id}">
          ${goal.isCompleted ? '✓ Completed' : 'Mark Done'}
        </button>
        <button class="btn btn-icon btn-ghost btn-delete-goal" data-goal-id="${goal._id}">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function attachWeeklyEventListeners(container) {
  // Add Weekly Goal
  const btnAdd = container.querySelector('#btn-add-weekly-goal');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'add-weekly-goal' } }));
    });
  }

  // Save Weekly Retrospective
  const btnSaveRetro = container.querySelector('#btn-save-weekly-retrospective');
  if (btnSaveRetro) {
    btnSaveRetro.addEventListener('click', async () => {
      const text = container.querySelector('#input-weekly-retrospective')?.value.trim();
      if (!text) {
        alert('Por favor escribe tus reflexiones o victorias de la semana.');
        return;
      }
      const weekNum = getWeekNumber(new Date());
      const key = `kizen_weekly_review_week_${weekNum}`;
      const isFirstTime = !localStorage.getItem(key);
      localStorage.setItem(key, text);

      if (isFirstTime) {
        await store.addXp(50, `Revisión Semanal de la Semana ${weekNum}`);
      }

      alert('¡Revisión semanal guardada con éxito!');
      renderWeeklyView(container);
    });
  }

  // Toggle Activity from Active Project
  container.querySelectorAll('.btn-toggle-weekly-activity').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projId = btn.dataset.projectId;
      const actId = btn.dataset.activityId;
      await store.toggleActivityComplete(projId, actId);
      renderWeeklyView(container);
    });
  });

  // Toggle Goal
  container.querySelectorAll('.btn-toggle-goal').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const goalId = btn.dataset.goalId;
      await store.toggleGoalComplete(goalId);
      renderWeeklyView(container);
    });
  });

  // Delete Goal
  container.querySelectorAll('.btn-delete-goal').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const goalId = btn.dataset.goalId;
      if (confirm('Delete this goal?')) {
        await store.deleteGoal(goalId);
        renderWeeklyView(container);
      }
    });
  });
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

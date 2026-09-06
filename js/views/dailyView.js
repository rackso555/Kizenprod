/**
 * DAILY COMMAND CENTER VIEW (js/views/dailyView.js)
 * Features Hero Level, Macro Objectives Hub (Weekly/Monthly), Interactive Calendar with day planner,
 * Actions for selected date, Rollover tasks, 7 Daily Pillars, and Multi-Project activities dashboard.
 */

import { store } from '../store.js';
import {
  calculateLevelData,
  formatDisplayDate
} from '../gamification.js';

// Internal state for interactive calendar
let calendarSelectedDate = null;
let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();

export function renderDailyView(container) {
  const { profile, dailyLog, tasks, projects, weeklyGoals, monthlyGoals, customTags, currentLogicalDate } = store;
  if (!profile || !dailyLog) {
    container.innerHTML = '<div class="card">Cargando Centro de Mando Diario...</div>';
    return;
  }

  const selectedDate = calendarSelectedDate || currentLogicalDate;
  const isSelectedDateToday = selectedDate === currentLogicalDate;

  const levelData = calculateLevelData(profile.totalXp);
  const completedPillarsCount = dailyLog.pillarsCompleted?.length || 0;
  const totalPillarsCount = profile.pillars.length;
  const isAllPillarsCompleted = completedPillarsCount === totalPillarsCount;

  // Filter tasks for the selected date
  const dateTasks = tasks.filter(
    (t) => (t.scheduledDate === selectedDate || (!t.scheduledDate && isSelectedDateToday)) && !t.isOptional
  );
  const optionalTasks = tasks.filter(
    (t) => (t.scheduledDate === selectedDate || (!t.scheduledDate && isSelectedDateToday)) && t.isOptional
  );
  const rolloverTasks = isSelectedDateToday ? tasks.filter(
    (t) => t.scheduledDate && t.scheduledDate < currentLogicalDate && !t.isCompleted
  ) : [];

  // Active weekly & monthly objectives
  const activeWeekly = weeklyGoals.filter(g => !g.isCompleted);
  const activeMonthly = monthlyGoals.filter(g => !g.isCompleted);

  // Active projects (multiple projects view)
  const activeProjects = store.getActiveProjects();

  container.innerHTML = `
    <!-- 1. Top Level Hero Card -->
    <div class="level-hero-card">
      <div class="level-hero-top">
        <div class="level-title-group">
          <span class="level-badge-large">LVL ${levelData.level}</span>
          <span class="level-rank-name">${levelData.rankTitle}</span>
        </div>
        <div class="level-streak-badge">
          🔥 ${profile.currentStreak || 0} Días de Racha
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

    <!-- 2. Macro Objectives Hub (Weekly & Monthly) -->
    <div class="card" style="background: linear-gradient(135deg, #0e1b33 0%, #152747 100%); border-color: rgba(56, 189, 248, 0.35); margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 0.85rem; font-weight: 700; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.05em;">
          🎯 Misiones Macro (Semanales & Mensuales)
        </span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">Enfoque Estratégico</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
        <!-- Monthly North Stars -->
        <div style="background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); padding: 10px; border-left: 3px solid #818cf8;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #a5b4fc; margin-bottom: 4px;">
            🗓️ Objetivo Mensual Activo:
          </div>
          ${activeMonthly.length === 0 ? `
            <div style="font-size: 0.78rem; color: var(--text-muted);">Sin objetivos mensuales. Establece uno en Monthly!</div>
          ` : activeMonthly.slice(0, 2).map(m => `
            <div style="font-size: 0.84rem; font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">
              • ${escapeHtml(m.title)}
            </div>
          `).join('')}
        </div>

        <!-- Weekly Sprint Goals -->
        <div style="background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); padding: 10px; border-left: 3px solid #38bdf8;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
            📅 Sprints Semanales (${activeWeekly.length}):
          </div>
          ${activeWeekly.length === 0 ? `
            <div style="font-size: 0.78rem; color: var(--text-muted);">Todos los sprints completados o sin fijar.</div>
          ` : activeWeekly.slice(0, 2).map(w => `
            <div style="font-size: 0.84rem; font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">
              • ${escapeHtml(w.title)}
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 3. Interactive Calendar & Day Planner -->
    <div class="card" style="background: var(--bg-surface); border-color: rgba(255, 255, 255, 0.08); margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-sm btn-ghost btn-cal-prev" title="Mes anterior">◀</button>
          <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);" id="cal-month-header">
            ${getMonthName(calendarCurrentMonth)} ${calendarCurrentYear}
          </span>
          <button class="btn btn-sm btn-ghost btn-cal-next" title="Mes siguiente">▶</button>
        </div>
        <button class="btn btn-sm btn-secondary btn-cal-today">Hoy</button>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-grid">
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 0.72rem; color: var(--text-muted); font-weight: 700; margin-bottom: 6px;">
          <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
        </div>
        <div class="calendar-days-grid" id="calendar-days-container" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
          ${renderCalendarDays(calendarCurrentYear, calendarCurrentMonth, selectedDate, currentLogicalDate, tasks)}
        </div>
      </div>

      <!-- Selected Date Info & Quick Add for this Day -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 8px;">
        <div style="font-size: 0.84rem; color: var(--text-secondary);">
          Viendo: <strong style="color: var(--color-primary);">${formatDisplayDate(selectedDate)}</strong>
          ${isSelectedDateToday ? ' (Hoy)' : ''}
        </div>
        <button class="btn btn-sm btn-primary" id="btn-add-task-for-selected-date">
          + Agregar Tarea para ${selectedDate.slice(5)}
        </button>
      </div>
    </div>

    <!-- 4. Action List for Selected Date & Rollovers -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; margin-bottom: 10px;">
      <div class="tag-filter-bar" id="tag-filter-bar" style="margin-bottom: 0; padding-bottom: 0; flex: 1;">
        <button class="filter-chip active" data-tag="all">Todos</button>
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
        + Acción
      </button>
    </div>

    <!-- Yesterday's Rollover Tasks (if today) -->
    ${rolloverTasks.length > 0 ? `
      <div class="rollover-card" style="margin-bottom: 12px;">
        <div class="rollover-header">
          <span>⏳ Tareas Pendientes de Ayer (${rolloverTasks.length})</span>
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
                  Hacer Hoy
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

    <!-- Task List Container for selected date -->
    <div class="task-list" id="daily-task-list">
      ${dateTasks.length === 0 ? `
        <div class="card" style="text-align: center; color: var(--text-secondary); padding: 22px;">
          No hay tareas programadas para ${formatDisplayDate(selectedDate)}.
          <br><button class="btn btn-sm btn-secondary" id="btn-quick-create-task" style="margin-top: 10px;">+ Crear Tarea para este día</button>
        </div>
      ` : dateTasks.map((task) => renderTaskItem(task)).join('')}
    </div>

    <!-- Optional / Bonus Tasks Tray -->
    ${optionalTasks.length > 0 ? `
      <details class="card" style="margin-top: 12px; cursor: pointer;">
        <summary style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">
          🎁 Tareas Opcionales / Bonus de Energía (${optionalTasks.length})
        </summary>
        <div class="task-list" style="margin-top: 10px;">
          ${optionalTasks.map((task) => renderTaskItem(task)).join('')}
        </div>
      </details>
    ` : ''}

    <!-- 5. The 7 Daily Pillars Section -->
    <div class="section-header" style="margin-top: 24px;">
      <div class="section-title">
        <span>🏛️ Los 7 Pilares Diarios</span>
        <span class="section-subtitle">(${completedPillarsCount}/${totalPillarsCount})</span>
      </div>
      <span class="section-subtitle">Reinicio 5:00 AM</span>
    </div>

    ${isAllPillarsCompleted ? `
      <div class="pillar-combo-card" style="margin-bottom: 12px;">
        <div class="combo-text">
          ✨ ¡7/7 Pilares Dominados! ¡+50 XP Combo Reclamado!
        </div>
      </div>
    ` : ''}

    <div class="pillars-grid" id="pillars-grid-container" style="margin-bottom: 24px;">
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

    <!-- 6. Multi-Project Dashboard Section (See more than 1 project at once!) -->
    <div class="section-header">
      <div>
        <div class="section-title">
          <span>📁 Proyectos en Curso (${activeProjects.length})</span>
        </div>
        <div class="section-subtitle">Actividades e hitos inmediatos de tus proyectos</div>
      </div>
    </div>

    <div class="multi-projects-container" style="display: flex; flex-direction: column; gap: 12px;">
      ${activeProjects.length === 0 ? `
        <div class="card" style="text-align: center; color: var(--text-secondary); padding: 18px;">
          No tienes proyectos activos aún. Créalos en la pestaña <strong>Projects</strong>!
        </div>
      ` : activeProjects.map((proj) => renderMultiProjectCard(proj)).join('')}
    </div>
  `;

  attachDailyEventListeners(container, selectedDate);
}

function renderMultiProjectCard(project) {
  const activities = project.activities || [];
  const completedCount = activities.filter(a => a.isCompleted).length;
  const progress = activities.length > 0 ? Math.round((completedCount / activities.length) * 100) : 0;

  return `
    <div class="card" style="background: linear-gradient(135deg, #101c2e 0%, #13243a 100%); border-color: rgba(56, 189, 248, 0.25); padding: 12px 14px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(project.name)}</span>
            <span class="tag-badge" style="font-size: 0.7rem;">${escapeHtml(project.category || 'General')}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
            ${escapeHtml(project.description || '')}
          </div>
        </div>
        <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-primary);">${completedCount}/${activities.length} (${progress}%)</span>
      </div>

      <div class="goal-progress-bar" style="height: 4px; margin-bottom: 10px;">
        <div class="goal-progress-fill" style="width: ${progress}%;"></div>
      </div>

      <!-- Activities list -->
      <div class="task-list" style="margin-bottom: 0;">
        ${activities.length === 0 ? `
          <div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px 0;">Sin actividades.</div>
        ` : activities.map((act) => `
          <div class="task-item ${act.isCompleted ? 'completed' : ''}" style="padding: 6px 10px; margin-bottom: 4px;">
            <div class="task-checkbox ${act.isCompleted ? 'checked' : ''} btn-toggle-multi-project-activity" 
                 data-project-id="${project._id}" data-activity-id="${act.id}">
              ${act.isCompleted ? '✓' : ''}
            </div>
            <div class="task-body">
              <div class="task-title" style="font-size: 0.82rem;">${escapeHtml(act.title)}</div>
            </div>
            <span class="tag-badge" style="color: var(--color-xp); font-size: 0.68rem;">+30 XP</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCalendarDays(year, month, selectedDate, todayDate, tasks) {
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  // Convert to Monday = 0
  const startDay = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create task counts map for this month
  const taskCounts = {};
  tasks.forEach((t) => {
    if (t.scheduledDate) {
      taskCounts[t.scheduledDate] = (taskCounts[t.scheduledDate] || 0) + 1;
    }
  });

  const cells = [];

  // Empty leading days
  for (let i = 0; i < startDay; i++) {
    cells.push(`<div style="padding: 8px 2px; opacity: 0.2;"></div>`);
  }

  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dayStr === todayDate;
    const isSelected = dayStr === selectedDate;
    const count = taskCounts[dayStr] || 0;

    cells.push(`
      <div class="cal-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-date="${dayStr}"
        style="
          padding: 6px 2px;
          text-align: center;
          border-radius: var(--radius-sm);
          cursor: pointer;
          background: ${isSelected ? 'var(--color-primary)' : isToday ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)'};
          color: ${isSelected ? '#090d16' : isToday ? 'var(--color-primary)' : 'var(--text-primary)'};
          font-weight: ${isSelected || isToday ? '800' : '500'};
          font-size: 0.8rem;
          position: relative;
          transition: transform 0.1s ease;
        ">
        <span>${d}</span>
        ${count > 0 ? `
          <div style="width: 4px; height: 4px; border-radius: 50%; background: ${isSelected ? '#090d16' : 'var(--color-xp)'}; margin: 2px auto 0;"></div>
        ` : ''}
      </div>
    `);
  }

  return cells.join('');
}

function getMonthName(monthIndex) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return months[monthIndex];
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
          ${task.scheduledDate ? `<span class="tag-badge">📅 ${task.scheduledDate}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-icon btn-ghost btn-delete-task" data-task-id="${task._id}" title="Eliminar">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function attachDailyEventListeners(container, selectedDate) {
  // Calendar day clicks
  container.querySelectorAll('.cal-day-cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      calendarSelectedDate = cell.dataset.date;
      renderDailyView(container);
    });
  });

  // Calendar prev/next month
  const btnPrev = container.querySelector('.btn-cal-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      calendarCurrentMonth--;
      if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
      }
      renderDailyView(container);
    });
  }

  const btnNext = container.querySelector('.btn-cal-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      calendarCurrentMonth++;
      if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
      }
      renderDailyView(container);
    });
  }

  // Calendar "Hoy" button
  const btnToday = container.querySelector('.btn-cal-today');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const now = new Date();
      calendarCurrentMonth = now.getMonth();
      calendarCurrentYear = now.getFullYear();
      calendarSelectedDate = store.currentLogicalDate;
      renderDailyView(container);
    });
  }

  // Add task for selected date button
  const btnAddForDate = container.querySelector('#btn-add-task-for-selected-date');
  if (btnAddForDate) {
    btnAddForDate.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', {
        detail: { modal: 'add-task', prefilledDate: selectedDate }
      }));
    });
  }

  const btnQuickCreate = container.querySelector('#btn-quick-create-task');
  if (btnQuickCreate) {
    btnQuickCreate.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', {
        detail: { modal: 'add-task', prefilledDate: selectedDate }
      }));
    });
  }

  // Toggle Pillar Cards
  container.querySelectorAll('.pillar-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const pillarId = card.dataset.pillarId;
      await store.togglePillar(pillarId);
      renderDailyView(container);
    });
  });

  // Toggle Multi-Project Activities
  container.querySelectorAll('.btn-toggle-multi-project-activity').forEach((box) => {
    box.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projId = box.dataset.projectId;
      const actId = box.dataset.activityId;
      await store.toggleActivityComplete(projId, actId);
      renderDailyView(container);
    });
  });

  // Toggle Task Completion
  container.querySelectorAll('.task-checkbox:not(.btn-toggle-multi-project-activity)').forEach((box) => {
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
      if (confirm('¿Eliminar esta tarea?')) {
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
      window.dispatchEvent(new CustomEvent('kizen-open-modal', {
        detail: { modal: 'add-task', prefilledDate: selectedDate }
      }));
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

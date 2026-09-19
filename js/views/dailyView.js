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

// Internal state for interactive calendar & views
let calendarSelectedDate = null;
let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();
let dailyTasksViewMode = 'list'; // 'list' | 'matrix'
let expandedPillarIds = new Set(['hygiene']); // first pillar expanded by default

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
  // Sort tasks: P1 first, then P2, P3, P4
  const pWeight = { p1: 1, p2: 2, p3: 3, p4: 4 };
  dateTasks.sort((a, b) => (pWeight[a.priority || 'p2'] || 2) - (pWeight[b.priority || 'p2'] || 2));

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

    <!-- 4. Quick Task Capture Bar (Inline syntax: #tags, p1-p4) -->
    <div class="card quick-capture-box" style="margin-bottom: 12px; padding: 10px 14px; background: rgba(56, 189, 248, 0.04); border: 1px solid rgba(56, 189, 248, 0.25);">
      <div style="font-size: 0.76rem; font-weight: 700; color: var(--color-primary); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>⚡ Captura Rápida de Acción</span>
        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">Usa #tag y p1/p2/p3/p4</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <input type="text" class="input-text" id="input-quick-task" placeholder="ej. Terminar reporte de métricas #deepwork p1" style="flex: 1; font-size: 0.84rem; padding: 8px 12px;">
        <button class="btn btn-primary btn-sm" id="btn-submit-quick-task" style="white-space: nowrap; padding: 0 14px; font-weight: 700;">+ Crear</button>
      </div>
    </div>

    <!-- 5. Action List / Matrix Toolbar -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
      <!-- View mode switch -->
      <div style="display: flex; gap: 4px; background: rgba(255,255,255,0.05); padding: 3px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
        <button class="btn btn-sm ${dailyTasksViewMode === 'list' ? 'btn-primary' : 'btn-ghost'}" id="btn-toggle-view-list" style="font-size: 0.76rem; padding: 4px 10px;">📋 Lista</button>
        <button class="btn btn-sm ${dailyTasksViewMode === 'matrix' ? 'btn-primary' : 'btn-ghost'}" id="btn-toggle-view-matrix" style="font-size: 0.76rem; padding: 4px 10px;">🗂️ Matriz 2x2</button>
      </div>

      <div style="display: flex; align-items: center; gap: 6px;">
        <button class="btn btn-sm btn-secondary" id="btn-manage-tags-fixed" style="font-size: 0.76rem; padding: 5px 10px;">
          🏷️ Tags (${customTags.length})
        </button>
        <button class="btn btn-sm btn-primary" id="btn-open-add-task" style="white-space: nowrap; font-size: 0.76rem; padding: 5px 12px;">
          + Acción
        </button>
      </div>
    </div>

    <!-- Tag Filter Bar -->
    <div class="tag-filter-bar" id="tag-filter-bar" style="margin-bottom: 12px; padding-bottom: 4px;">
      <button class="filter-chip active" data-tag="all">Todos</button>
      ${customTags.map((tag) => `
        <button class="filter-chip" data-tag="${tag.id}" style="--tag-color: ${tag.color};">
          ${tag.label}
        </button>
      `).join('')}
      <button class="filter-chip btn-ghost" id="btn-manage-tags" style="border: 1px dashed var(--border-medium); font-size: 0.72rem;">⚙️ Tags</button>
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

    <!-- Action Tasks View (List or Eisenhower Matrix) -->
    ${dailyTasksViewMode === 'matrix' ? `
      <div id="eisenhower-matrix-container">
        ${renderEisenhowerMatrix(dateTasks)}
      </div>
    ` : `
      <div class="task-list" id="daily-task-list">
        ${dateTasks.length === 0 ? `
          <div class="card" style="text-align: center; color: var(--text-secondary); padding: 22px;">
            No hay tareas programadas para ${formatDisplayDate(selectedDate)}.
            <br><button class="btn btn-sm btn-secondary" id="btn-quick-create-task" style="margin-top: 10px;">+ Crear Tarea para este día</button>
          </div>
        ` : dateTasks.map((task) => renderTaskItem(task)).join('')}
      </div>
    `}

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

    <!-- 6. The 7 Daily Pillars Section with Subtasks Accordion -->
    <div class="section-header" style="margin-top: 24px;">
      <div class="section-title">
        <span>🏛️ Los 7 Pilares Diarios & Hábitos</span>
        <span class="section-subtitle">(${completedPillarsCount}/${totalPillarsCount} Completos)</span>
      </div>
      <span class="section-subtitle">Reinicio 5:00 AM • +5 XP por hábito</span>
    </div>

    ${isAllPillarsCompleted ? `
      <div class="pillar-combo-card" style="margin-bottom: 12px;">
        <div class="combo-text">
          ✨ ¡7/7 Pilares Dominados! ¡+50 XP Combo Reclamado!
        </div>
      </div>
    ` : ''}

    <div class="pillars-accordion-list" id="pillars-container" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
      ${profile.pillars.map((pillar) => renderPillarCard(pillar, dailyLog)).join('')}
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

function renderPillarCard(pillar, dailyLog) {
  const isDone = dailyLog.pillarsCompleted?.includes(pillar.id);
  const subtasks = pillar.subtasks || [];
  const completedSubtasks = dailyLog.pillarSubtasksCompleted?.[pillar.id] || [];
  const completedCount = completedSubtasks.length;
  const totalCount = subtasks.length;
  const isExpanded = expandedPillarIds.has(pillar.id);

  return `
    <div class="card pillar-accordion-card ${isDone ? 'completed' : ''}" style="padding: 0; overflow: hidden; border-left: 4px solid ${isDone ? 'var(--color-success)' : 'var(--color-primary)'}; margin-bottom: 0;">
      <div class="pillar-accordion-header" style="padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02);">
        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; cursor: pointer;" class="btn-toggle-pillar-accordion" data-pillar-id="${pillar.id}">
          <span class="pillar-chevron" style="font-size: 0.75rem; color: var(--text-muted); width: 14px; text-align: center;">
            ${isExpanded ? '▼' : '▶'}
          </span>
          <span class="pillar-icon" style="font-size: 1.25rem;">${pillar.icon}</span>
          <div class="pillar-text-group" style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="pillar-name" style="font-size: 0.9rem; font-weight: 700;">${escapeHtml(pillar.name)}</span>
              ${totalCount > 0 ? `
                <span class="tag-badge" style="font-size: 0.68rem; padding: 2px 6px; font-weight: 700; background: ${completedCount === totalCount ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)'}; color: ${completedCount === totalCount ? 'var(--color-success)' : 'var(--text-secondary)'};">
                  ${completedCount}/${totalCount}
                </span>
              ` : ''}
            </div>
            <span class="pillar-subtext" style="font-size: 0.74rem; color: var(--text-secondary); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(pillar.subtext || pillar.description || '')}
            </span>
          </div>
        </div>

        <div class="pillar-header-actions" style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
          <div class="pillar-check-box ${isDone ? 'checked' : ''} btn-toggle-master-pillar" data-pillar-id="${pillar.id}" title="Completar todo el pilar (+15 XP)" style="cursor: pointer; width: 28px; height: 28px; border-radius: var(--radius-sm); border: 2px solid ${isDone ? 'var(--color-success)' : 'var(--border-medium)'}; background: ${isDone ? 'var(--color-success)' : 'transparent'}; display: flex; align-items: center; justify-content: center; font-weight: 800; color: white;">
            ${isDone ? '✓' : ''}
          </div>
        </div>
      </div>

      <!-- Collapsible Subtasks Panel -->
      ${isExpanded ? `
        <div class="pillar-subtasks-panel" style="padding: 10px 14px 12px; border-top: 1px solid var(--border-subtle); background: rgba(0,0,0,0.18);">
          <div class="pillar-subtasks-list" style="display: flex; flex-direction: column; gap: 6px;">
            ${subtasks.length === 0 ? `
              <div style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 4px 0;">
                No hay hábitos definidos para este pilar. ¡Añade tu primera subtarea abajo!
              </div>
            ` : subtasks.map((sub) => {
              const subDone = completedSubtasks.includes(sub.id);
              return `
                <div class="pillar-subtask-item ${subDone ? 'completed' : ''}" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.02);">
                  <div style="display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer;" class="btn-toggle-subtask" data-pillar-id="${pillar.id}" data-subtask-id="${sub.id}">
                    <div class="task-checkbox ${subDone ? 'checked' : ''}" style="width: 18px; height: 18px; font-size: 0.75rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; border: 1.5px solid ${subDone ? 'var(--color-success)' : 'var(--border-medium)'}; background: ${subDone ? 'var(--color-success)' : 'transparent'}; color: white;">
                      ${subDone ? '✓' : ''}
                    </div>
                    <span style="font-size: 0.82rem; color: ${subDone ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${subDone ? 'line-through' : 'none'};">
                      ${escapeHtml(sub.title)}
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 0.68rem; font-weight: 700; color: var(--color-xp);">+${sub.xp || 5} XP</span>
                    <button class="btn btn-icon btn-ghost btn-delete-subtask" data-pillar-id="${pillar.id}" data-subtask-id="${sub.id}" style="padding: 2px 6px; font-size: 0.75rem; color: var(--text-muted);" title="Eliminar hábito">✕</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Add new subtask row -->
          <div class="add-subtask-form" style="display: flex; gap: 6px; margin-top: 10px;">
            <input type="text" class="input-text input-sm input-new-subtask" data-pillar-id="${pillar.id}" placeholder="+ Añadir hábito para ${escapeHtml(pillar.name)} (+5 XP)..." style="font-size: 0.78rem; padding: 6px 10px; flex: 1;">
            <button class="btn btn-sm btn-secondary btn-submit-new-subtask" data-pillar-id="${pillar.id}" style="font-size: 0.75rem; padding: 6px 10px;">
              Añadir
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderEisenhowerMatrix(tasks) {
  const q1 = tasks.filter(t => (t.priority || 'p2') === 'p1');
  const q2 = tasks.filter(t => (t.priority || 'p2') === 'p2');
  const q3 = tasks.filter(t => (t.priority || 'p2') === 'p3');
  const q4 = tasks.filter(t => (t.priority || 'p2') === 'p4');

  return `
    <div class="eisenhower-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 16px;">
      <!-- Q1: Urgente & Importante -->
      <div class="card eisenhower-card q-p1" style="border-left: 4px solid var(--color-danger); background: rgba(239, 68, 68, 0.04); margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.82rem; font-weight: 800; color: var(--color-danger);">🔴 P1: Urgente & Importante</span>
          <span class="tag-badge" style="font-size: 0.68rem; background: rgba(239, 68, 68, 0.15); color: var(--color-danger); font-weight: 700;">Hazlo Ya (${q1.length})</span>
        </div>
        <div class="task-list">
          ${q1.length === 0 ? '<div style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 8px 0;">Sin tareas urgentes prioritarias</div>' : q1.map(renderTaskItem).join('')}
        </div>
      </div>

      <!-- Q2: Importante, No Urgente -->
      <div class="card eisenhower-card q-p2" style="border-left: 4px solid var(--color-xp); background: rgba(245, 158, 11, 0.04); margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.82rem; font-weight: 800; color: var(--color-xp);">🟡 P2: Importante, No Urgente</span>
          <span class="tag-badge" style="font-size: 0.68rem; background: rgba(245, 158, 11, 0.15); color: var(--color-xp); font-weight: 700;">Deep Work (${q2.length})</span>
        </div>
        <div class="task-list">
          ${q2.length === 0 ? '<div style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 8px 0;">Sin tareas estratégicas de sprint</div>' : q2.map(renderTaskItem).join('')}
        </div>
      </div>

      <!-- Q3: Urgente, No Importante -->
      <div class="card eisenhower-card q-p3" style="border-left: 4px solid var(--color-primary); background: rgba(56, 189, 248, 0.04); margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.82rem; font-weight: 800; color: var(--color-primary);">🔵 P3: Urgente, No Importante</span>
          <span class="tag-badge" style="font-size: 0.68rem; background: rgba(56, 189, 248, 0.15); color: var(--color-primary); font-weight: 700;">Rutina / Delegar (${q3.length})</span>
        </div>
        <div class="task-list">
          ${q3.length === 0 ? '<div style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 8px 0;">Sin tareas operativas rápidas</div>' : q3.map(renderTaskItem).join('')}
        </div>
      </div>

      <!-- Q4: No Urgente, Ni Importante -->
      <div class="card eisenhower-card q-p4" style="border-left: 4px solid var(--text-muted); background: rgba(255, 255, 255, 0.02); margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.82rem; font-weight: 800; color: var(--text-secondary);">⚪ P4: Baja Prioridad</span>
          <span class="tag-badge" style="font-size: 0.68rem; background: rgba(255, 255, 255, 0.08); color: var(--text-secondary); font-weight: 700;">Backlog (${q4.length})</span>
        </div>
        <div class="task-list">
          ${q4.length === 0 ? '<div style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 8px 0;">Sin tareas en backlog</div>' : q4.map(renderTaskItem).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTaskItem(task) {
  const p = task.priority || 'p2';
  const pBadge = p === 'p1' ? '<span class="priority-pill p1" style="font-size: 0.68rem; font-weight: 700; color: #ef4444; background: rgba(239, 68, 68, 0.15); padding: 2px 6px; border-radius: 4px;">🔴 P1</span>'
    : p === 'p3' ? '<span class="priority-pill p3" style="font-size: 0.68rem; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 2px 6px; border-radius: 4px;">🔵 P3</span>'
    : p === 'p4' ? '<span class="priority-pill p4" style="font-size: 0.68rem; font-weight: 700; color: #94a3b8; background: rgba(148, 163, 184, 0.15); padding: 2px 6px; border-radius: 4px;">⚪ P4</span>'
    : '<span class="priority-pill p2" style="font-size: 0.68rem; font-weight: 700; color: #f59e0b; background: rgba(245, 158, 11, 0.15); padding: 2px 6px; border-radius: 4px;">🟡 P2</span>';

  return `
    <div class="task-item ${task.isCompleted ? 'completed' : ''}" data-task-id="${task._id}">
      <div class="task-checkbox ${task.isCompleted ? 'checked' : ''}" data-task-id="${task._id}">
        ${task.isCompleted ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta-row">
          ${pBadge}
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

  // Quick Task Capture
  const inputQuick = container.querySelector('#input-quick-task');
  const btnSubmitQuick = container.querySelector('#btn-submit-quick-task');
  const handleQuickAdd = async () => {
    if (!inputQuick || !inputQuick.value.trim()) return;
    const rawVal = inputQuick.value.trim();
    const parsed = store.parseTaskInput(rawVal);
    // Ensure extracted tags exist in store
    for (const tag of parsed.tags) {
      await store.addCustomTag(tag);
    }
    await store.addTask({
      title: parsed.title,
      tags: parsed.tags,
      priority: parsed.priority,
      scheduledDate: selectedDate,
      difficulty: 'easy'
    });
    inputQuick.value = '';
    renderDailyView(container);
  };

  if (btnSubmitQuick) {
    btnSubmitQuick.addEventListener('click', handleQuickAdd);
  }
  if (inputQuick) {
    inputQuick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickAdd();
      }
    });
  }

  // View Mode Switches (List vs Matrix)
  const btnViewList = container.querySelector('#btn-toggle-view-list');
  if (btnViewList) {
    btnViewList.addEventListener('click', () => {
      dailyTasksViewMode = 'list';
      renderDailyView(container);
    });
  }

  const btnViewMatrix = container.querySelector('#btn-toggle-view-matrix');
  if (btnViewMatrix) {
    btnViewMatrix.addEventListener('click', () => {
      dailyTasksViewMode = 'matrix';
      renderDailyView(container);
    });
  }

  // Toggle Pillar Accordion Expand/Collapse
  container.querySelectorAll('.btn-toggle-pillar-accordion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pillarId = btn.dataset.pillarId;
      if (expandedPillarIds.has(pillarId)) {
        expandedPillarIds.delete(pillarId);
      } else {
        expandedPillarIds.add(pillarId);
      }
      renderDailyView(container);
    });
  });

  // Toggle Master Pillar Completion
  container.querySelectorAll('.btn-toggle-master-pillar').forEach((box) => {
    box.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pillarId = box.dataset.pillarId;
      await store.togglePillar(pillarId);
      renderDailyView(container);
    });
  });

  // Toggle Subtask Completion
  container.querySelectorAll('.btn-toggle-subtask').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pillarId = btn.dataset.pillarId;
      const subtaskId = btn.dataset.subtaskId;
      await store.togglePillarSubtask(pillarId, subtaskId);
      renderDailyView(container);
    });
  });

  // Delete Subtask
  container.querySelectorAll('.btn-delete-subtask').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pillarId = btn.dataset.pillarId;
      const subtaskId = btn.dataset.subtaskId;
      if (confirm('¿Eliminar este hábito del pilar?')) {
        await store.deletePillarSubtask(pillarId, subtaskId);
        renderDailyView(container);
      }
    });
  });

  // Add New Subtask to Pillar
  container.querySelectorAll('.btn-submit-new-subtask').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pillarId = btn.dataset.pillarId;
      const input = container.querySelector(`.input-new-subtask[data-pillar-id="${pillarId}"]`);
      if (input && input.value.trim()) {
        await store.addPillarSubtask(pillarId, input.value.trim());
        renderDailyView(container);
      }
    });
  });

  container.querySelectorAll('.input-new-subtask').forEach((input) => {
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const pillarId = input.dataset.pillarId;
        if (input.value.trim()) {
          await store.addPillarSubtask(pillarId, input.value.trim());
          renderDailyView(container);
        }
      }
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
      if (taskId) {
        await store.toggleTask(taskId);
        renderDailyView(container);
      }
    });
  });

  // Delete Task
  container.querySelectorAll('.btn-delete-task').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      if (taskId && confirm('¿Eliminar esta tarea?')) {
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

  // Fixed Manage Tags Button (Mobile friendly)
  const btnManageTagsFixed = container.querySelector('#btn-manage-tags-fixed');
  if (btnManageTagsFixed) {
    btnManageTagsFixed.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'manage-tags' } }));
    });
  }

  // Manage Tags Chip in scrollbar
  const btnManageTags = container.querySelector('#btn-manage-tags');
  if (btnManageTags) {
    btnManageTags.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'manage-tags' } }));
    });
  }
}

function filterTaskList(container, tagId) {
  const items = container.querySelectorAll('.task-item');
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

/**
 * PROJECTS & NESTED ACTIVITIES VIEW (js/views/projectsView.js)
 * Manages project hierarchies, active focus project switcher, and responsive Kanban boards.
 */

import { store } from '../store.js';

let activeProjectMode = 'tree'; // 'tree' | 'kanban'
let selectedProjectId = null;

export function renderProjectsView(container) {
  const { projects, profile } = store;
  const activeProj = store.getActiveProject();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>📁 Projects & Roadmaps</h1>
        <div class="section-subtitle">Active Focus: <strong style="color: var(--color-primary);">${activeProj ? escapeHtml(activeProj.name) : 'None'}</strong></div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-add-project">
        + New Project
      </button>
    </div>

    <!-- Mode Selector (Tree vs Kanban) -->
    <div class="view-toggle-bar">
      <span class="section-title" style="font-size: 0.9rem;">
        ${selectedProjectId ? '🔍 Project Detail' : '📂 All Projects (' + projects.length + ')'}
      </span>
      <div class="view-toggle-pills">
        <button class="view-toggle-btn ${activeProjectMode === 'tree' ? 'active' : ''}" id="toggle-mode-tree">
          🌳 Tree
        </button>
        <button class="view-toggle-btn ${activeProjectMode === 'kanban' ? 'active' : ''}" id="toggle-mode-kanban">
          📊 Kanban
        </button>
      </div>
    </div>

    ${selectedProjectId ? renderSelectedProjectDetail(projects.find(p => p._id === selectedProjectId), activeProj?._id) : ''}

    ${!selectedProjectId && activeProjectMode === 'tree' ? `
      <div class="projects-grid">
        ${projects.length === 0 ? `
          <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 24px;">
            No projects created yet. Click <strong>+ New Project</strong> to build your first project tree!
          </div>
        ` : projects.map((p) => renderProjectCard(p, p._id === activeProj?._id)).join('')}
      </div>
    ` : ''}

    ${!selectedProjectId && activeProjectMode === 'kanban' ? renderKanbanBoard(projects) : ''}
  `;

  attachProjectsEventListeners(container);
}

function renderProjectCard(project, isActive) {
  const totalActs = project.activities?.length || 0;
  const completedActs = project.activities?.filter(a => a.isCompleted).length || 0;
  const progress = totalActs > 0 ? Math.round((completedActs / totalActs) * 100) : 0;

  return `
    <div class="project-card ${isActive ? 'active-focus-card' : ''}" data-project-id="${project._id}" 
         style="${isActive ? 'border-color: rgba(56, 189, 248, 0.5); background: linear-gradient(135deg, #101c2e 0%, #13243a 100%);' : ''}">
      <div>
        <div class="project-top-row">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="tag-badge">${escapeHtml(project.category || 'General')}</span>
            ${isActive ? `<span class="tag-badge" style="background: rgba(56, 189, 248, 0.2); color: var(--color-primary); font-weight: 700;">⭐ Active Focus</span>` : ''}
          </div>
          <span class="project-xp-earned">⚡ ${completedActs * 30} XP</span>
        </div>
        <div class="project-name" style="margin-top: 6px;">${escapeHtml(project.name)}</div>
        <p class="project-description" style="margin-top: 4px;">${escapeHtml(project.description || 'No description.')}</p>
      </div>

      <div>
        <div class="goal-progress-row">
          <span>Activities: ${completedActs}/${totalActs}</span>
          <span>${progress}%</span>
        </div>
        <div class="goal-progress-bar" style="margin-top: 4px;">
          <div class="goal-progress-fill" style="width: ${progress}%;"></div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
          <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-xp'} btn-set-active-project" data-project-id="${project._id}">
            ${isActive ? '✓ Current Focus' : '⭐ Set as Active Focus'}
          </button>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Click card to view</span>
        </div>
      </div>
    </div>
  `;
}

function renderSelectedProjectDetail(project, activeProjectId) {
  if (!project) return '';
  const activities = project.activities || [];
  const isActive = project._id === activeProjectId;

  return `
    <div class="card project-detail-header" style="${isActive ? 'border-color: rgba(56, 189, 248, 0.4);' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <button class="btn btn-sm btn-ghost" id="btn-back-to-projects">
          ← Back to All Projects
        </button>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-xp'} btn-set-active-project" data-project-id="${project._id}">
            ${isActive ? '⭐ Current Active Focus' : '⭐ Set as Active Focus'}
          </button>
          <button class="btn btn-sm btn-ghost btn-delete-project" data-project-id="${project._id}">
            🗑️
          </button>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
        <h2>${escapeHtml(project.name)}</h2>
        <span class="tag-badge">${escapeHtml(project.category)}</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(project.description)}</p>
      
      <div style="margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 0.9rem; font-weight: 700;">Activities & Milestones (${activities.filter(a => a.isCompleted).length}/${activities.length})</span>
          <button class="btn btn-sm btn-primary" id="btn-add-activity-to-project">
            + Activity
          </button>
        </div>

        <div class="task-list">
          ${activities.length === 0 ? `
            <div style="font-size: 0.8rem; color: var(--text-muted); padding: 12px 0;">
              No activities added yet. Click + Activity above to create milestones!
            </div>
          ` : activities.map((act) => `
            <div class="task-item ${act.isCompleted ? 'completed' : ''}">
              <div class="task-checkbox ${act.isCompleted ? 'checked' : ''} btn-toggle-activity" 
                   data-project-id="${project._id}" data-activity-id="${act.id}">
                ${act.isCompleted ? '✓' : ''}
              </div>
              <div class="task-body">
                <div class="task-title">${escapeHtml(act.title)}</div>
                <div class="task-meta-row">
                  <span class="tag-badge" style="color: var(--color-xp);">+30 XP</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderKanbanBoard(projects) {
  const allTasks = store.tasks;
  const backlog = allTasks.filter(t => !t.isCompleted && !t.dueDate);
  const inProgress = allTasks.filter(t => !t.isCompleted && t.dueDate);
  const done = allTasks.filter(t => t.isCompleted);

  return `
    <div class="kanban-board">
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span>📋 Backlog</span>
          <span>${backlog.length}</span>
        </div>
        <div class="kanban-items-list">
          ${backlog.map(t => renderKanbanCard(t)).join('')}
        </div>
      </div>

      <div class="kanban-col">
        <div class="kanban-col-header">
          <span>⚡ In Progress / Scheduled</span>
          <span>${inProgress.length}</span>
        </div>
        <div class="kanban-items-list">
          ${inProgress.map(t => renderKanbanCard(t)).join('')}
        </div>
      </div>

      <div class="kanban-col">
        <div class="kanban-col-header">
          <span>✓ Done</span>
          <span>${done.length}</span>
        </div>
        <div class="kanban-items-list">
          ${done.map(t => renderKanbanCard(t)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderKanbanCard(task) {
  return `
    <div class="kanban-card">
      <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
        ${escapeHtml(task.title)}
      </div>
      <div class="task-meta-row" style="margin-top: 6px;">
        <span class="difficulty-pill ${task.difficulty}">+${task.xpAwarded} XP</span>
        ${(task.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>
  `;
}

function attachProjectsEventListeners(container) {
  // Toggle Tree / Kanban
  const btnTree = container.querySelector('#toggle-mode-tree');
  const btnKanban = container.querySelector('#toggle-mode-kanban');
  if (btnTree) {
    btnTree.addEventListener('click', () => {
      activeProjectMode = 'tree';
      selectedProjectId = null;
      renderProjectsView(container);
    });
  }
  if (btnKanban) {
    btnKanban.addEventListener('click', () => {
      activeProjectMode = 'kanban';
      selectedProjectId = null;
      renderProjectsView(container);
    });
  }

  // Set as Active Project
  container.querySelectorAll('.btn-set-active-project').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projId = btn.dataset.projectId;
      await store.setActiveProject(projId);
      renderProjectsView(container);
    });
  });

  // Select Project Card (view details)
  container.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-set-active-project')) return;
      selectedProjectId = card.dataset.projectId;
      renderProjectsView(container);
    });
  });

  // Back to All Projects
  const btnBack = container.querySelector('#btn-back-to-projects');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      selectedProjectId = null;
      renderProjectsView(container);
    });
  }

  // Add Project
  const btnAddProj = container.querySelector('#btn-add-project');
  if (btnAddProj) {
    btnAddProj.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kizen-open-modal', { detail: { modal: 'add-project' } }));
    });
  }

  // Add Activity to selected project
  const btnAddAct = container.querySelector('#btn-add-activity-to-project');
  if (btnAddAct && selectedProjectId) {
    btnAddAct.addEventListener('click', () => {
      const actTitle = prompt('Enter new activity/milestone title:');
      if (actTitle && actTitle.trim()) {
        const project = store.projects.find(p => p._id === selectedProjectId);
        if (project) {
          project.activities = project.activities || [];
          project.activities.push({
            id: `act_${Date.now()}`,
            title: actTitle.trim(),
            isCompleted: false
          });
          store.addProject(project).then(() => renderProjectsView(container));
        }
      }
    });
  }

  // Toggle Activity Completion
  container.querySelectorAll('.btn-toggle-activity').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projId = btn.dataset.projectId;
      const actId = btn.dataset.activityId;
      await store.toggleActivityComplete(projId, actId);
      renderProjectsView(container);
    });
  });

  // Delete Project
  container.querySelectorAll('.btn-delete-project').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projId = btn.dataset.projectId;
      if (confirm('Delete this project and its activities?')) {
        await store.deleteProject(projId);
        selectedProjectId = null;
        renderProjectsView(container);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

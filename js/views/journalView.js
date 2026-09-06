/**
 * DEDICATED JOURNAL & GRATITUDE VIEW (js/views/journalView.js)
 * Expanded reflection space, gratitude prompts, tagging, mood tracking, and past entries reader.
 */

import { store } from '../store.js';
import { formatDisplayDate } from '../gamification.js';

let activeTagFilter = 'all';
let searchQuery = '';
let selectedDateForEditor = null;

export function renderJournalView(container) {
  const { journalEntries, currentLogicalDate, customTags } = store;
  const targetDate = selectedDateForEditor || currentLogicalDate;

  // Find existing entry for targetDate if any
  const currentEntry = journalEntries.find((e) => e.date === targetDate) || {
    date: targetDate,
    gratitudeItems: ['', '', ''],
    journalText: '',
    tags: ['#reflexion'],
    mood: 'calm'
  };

  // Filter past entries
  const filteredEntries = journalEntries.filter((entry) => {
    const matchesTag = activeTagFilter === 'all' || (entry.tags && entry.tags.includes(activeTagFilter));
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (entry.journalText && entry.journalText.toLowerCase().includes(query)) ||
      (entry.gratitudeItems && entry.gratitudeItems.some(g => g.toLowerCase().includes(query))) ||
      (entry.date && entry.date.includes(query));
    return matchesTag && matchesSearch;
  });

  // Extract all unique tags across entries + default suggested tags
  const allUniqueTags = Array.from(new Set([
    '#reflexion', '#gratitud', '#aprendizaje', '#ideas', '#logros', '#enfoque',
    ...(customTags || []).map(t => t.label),
    ...journalEntries.flatMap(e => e.tags || [])
  ]));

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>📖 Diario & Reflexión</h1>
        <div class="section-subtitle">Espacio libre de pensamiento, gratitud y registro personal</div>
      </div>
      <span class="tag-badge" style="color: var(--color-xp); font-size: 0.8rem;">+25 XP por día</span>
    </div>

    <!-- Active Writing Workspace -->
    <div class="card" style="background: linear-gradient(135deg, #0e172a 0%, #131d35 100%); border-color: rgba(56, 189, 248, 0.3); margin-bottom: 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 700; font-size: 0.95rem; color: var(--color-primary);">✍️ Entrada del Día:</span>
          <input type="date" class="input-text" id="journal-entry-date" value="${targetDate}" 
            style="padding: 4px 10px; width: auto; font-size: 0.85rem; background: var(--bg-surface-elevated);">
        </div>
        <div class="mood-selector" id="journal-mood-selector">
          ${renderMoodButton('inspired', '✨', 'Inspirado', currentEntry.mood)}
          ${renderMoodButton('calm', '🧘', 'En Calma', currentEntry.mood)}
          ${renderMoodButton('focused', '🎯', 'Enfocado', currentEntry.mood)}
          ${renderMoodButton('tired', '🥱', 'Agotado', currentEntry.mood)}
          ${renderMoodButton('reflective', '🌧️', 'Pensativo', currentEntry.mood)}
        </div>
      </div>

      <!-- Gratitude Prompt -->
      <div class="input-group" style="margin-bottom: 14px;">
        <label class="input-label" style="display: flex; justify-content: space-between;">
          <span>🌱 Hoy agradezco por:</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">1 a 3 momentos o cosas positivas</span>
        </label>
        <div class="gratitude-list-inputs">
          ${[0, 1, 2].map((idx) => `
            <div class="gratitude-row" style="margin-bottom: 6px;">
              <span class="gratitude-num">${idx + 1}.</span>
              <input type="text" class="input-text journal-gratitude-item" data-index="${idx}"
                placeholder="${idx === 0 ? 'Un pequeño logro o momento de paz...' : idx === 1 ? 'Una persona o recurso valioso...' : 'Una lección o sorpresa del día...'}"
                value="${escapeHtml(currentEntry.gratitudeItems?.[idx] || '')}">
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Expanded Freeform Reflection -->
      <div class="input-group">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <label class="input-label" style="margin-bottom: 0;">💭 Reflexión Profunda & Notas del Día:</label>
          <span id="journal-word-count" style="font-size: 0.75rem; color: var(--text-muted);">0 palabras</span>
        </div>
        <textarea class="textarea" id="journal-main-text" 
          placeholder="¿Qué funcionó bien hoy? ¿Qué obstáculo superaste? ¿Qué descubriste sobre ti mismo o qué ajustarás mañana? Escribe libremente sin límites..."
          style="min-height: 180px; font-size: 0.9rem; line-height: 1.6;">${escapeHtml(currentEntry.journalText || '')}</textarea>
      </div>

      <!-- Tag Selector for Journal Entry -->
      <div class="input-group" style="margin-top: 10px;">
        <label class="input-label">🏷️ Asignar Etiquetas (Tags):</label>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="journal-tag-chips">
          ${allUniqueTags.map((tag) => {
            const isSelected = (currentEntry.tags || []).includes(tag);
            return `
              <button type="button" class="filter-chip ${isSelected ? 'active' : ''} btn-toggle-entry-tag" data-tag="${escapeHtml(tag)}">
                ${escapeHtml(tag)}
              </button>
            `;
          }).join('')}
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <input type="text" class="input-text" id="input-new-custom-tag" placeholder="Escribir nuevo tag (#salud, #familia...)" style="flex: 1; font-size: 0.8rem; padding: 4px 10px;">
          <button class="btn btn-sm btn-secondary" id="btn-add-tag-to-entry">+ Añadir Tag</button>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
        <button class="btn btn-primary" id="btn-save-journal-entry" style="flex: 1;">
          💾 Guardar Entrada de Diario (+25 XP)
        </button>
      </div>
    </div>

    <!-- Past Journal Entries Browser & History -->
    <div class="section-header" style="margin-top: 24px;">
      <div>
        <h2 style="font-size: 1.1rem;">📚 Historial de Reflexiones (${journalEntries.length})</h2>
        <div class="section-subtitle">Repasa tus aprendizajes, gratitud y crecimiento diario</div>
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
      <input type="text" class="input-text" id="journal-search-input" 
        placeholder="🔍 Buscar por palabra o fecha..." value="${escapeHtml(searchQuery)}" style="flex: 1; min-width: 180px;">
      
      <div class="tag-filter-bar" style="margin-bottom: 0; padding-bottom: 0; flex: 1;">
        <button class="filter-chip ${activeTagFilter === 'all' ? 'active' : ''} btn-filter-journal" data-tag="all">Todos</button>
        ${allUniqueTags.slice(0, 6).map((tag) => `
          <button class="filter-chip ${activeTagFilter === tag ? 'active' : ''} btn-filter-journal" data-tag="${escapeHtml(tag)}">
            ${escapeHtml(tag)}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="journal-history-list" id="journal-history-container">
      ${filteredEntries.length === 0 ? `
        <div class="card" style="text-align: center; color: var(--text-secondary); padding: 24px;">
          No se encontraron entradas de diario que coincidan con la búsqueda. ¡Escribe tu primera reflexión arriba!
        </div>
      ` : filteredEntries.map((entry) => renderJournalEntryCard(entry)).join('')}
    </div>
  `;

  attachJournalEventListeners(container, currentEntry);
  updateWordCount(container);
}

function renderMoodButton(moodKey, emoji, label, currentMood) {
  const isSelected = currentMood === moodKey;
  return `
    <button type="button" class="btn-mood ${isSelected ? 'active' : ''}" data-mood="${moodKey}" title="${label}" 
      style="border: none; background: ${isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)'}; border-radius: var(--radius-sm); padding: 4px 8px; font-size: 1rem; cursor: pointer;">
      ${emoji}
    </button>
  `;
}

function renderJournalEntryCard(entry) {
  const dateFormatted = entry.date ? formatDisplayDate(entry.date) : 'Sin fecha';
  const moodEmoji = {
    inspired: '✨ Inspirado',
    calm: '🧘 En Calma',
    focused: '🎯 Enfocado',
    tired: '🥱 Agotado',
    reflective: '🌧️ Pensativo'
  }[entry.mood] || '📖 Reflexión';

  const gratitudes = (entry.gratitudeItems || []).filter(Boolean);

  return `
    <div class="card journal-entry-card" data-entry-id="${entry._id}" style="margin-bottom: 12px; border-left: 3px solid var(--color-primary);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div>
          <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">📅 ${dateFormatted}</span>
          <span class="tag-badge" style="margin-left: 6px; font-size: 0.75rem;">${moodEmoji}</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm btn-ghost btn-load-entry" data-date="${entry.date}" title="Editar esta entrada">
            ✏️ Editar
          </button>
          <button class="btn btn-sm btn-ghost btn-delete-journal" data-id="${entry._id}" title="Eliminar entrada">
            🗑️
          </button>
        </div>
      </div>

      ${gratitudes.length > 0 ? `
        <div style="margin-bottom: 8px; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); font-size: 0.82rem; color: var(--text-secondary);">
          <strong style="color: var(--color-success); font-size: 0.78rem;">🌱 Gratitud:</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            ${gratitudes.map(g => `<li>${escapeHtml(g)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${entry.journalText ? `
        <p style="font-size: 0.86rem; color: var(--text-primary); line-height: 1.55; white-space: pre-wrap; margin-bottom: 8px;">
          ${escapeHtml(entry.journalText)}
        </p>
      ` : ''}

      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; border-top: 1px solid var(--border-subtle); padding-top: 6px;">
        ${(entry.tags || []).map(t => `<span class="tag-badge" style="font-size: 0.72rem;">${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>
  `;
}

function updateWordCount(container) {
  const textarea = container.querySelector('#journal-main-text');
  const countDisplay = container.querySelector('#journal-word-count');
  if (textarea && countDisplay) {
    const text = textarea.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    countDisplay.innerText = `${words} palabras • ${text.length} caracteres`;
  }
}

function attachJournalEventListeners(container, currentEntry) {
  let selectedMood = currentEntry.mood || 'calm';
  let activeEntryTags = new Set(currentEntry.tags || ['#reflexion']);

  // Date picker change
  const datePicker = container.querySelector('#journal-entry-date');
  if (datePicker) {
    datePicker.addEventListener('change', (e) => {
      selectedDateForEditor = e.target.value;
      renderJournalView(container);
    });
  }

  // Mood buttons
  container.querySelectorAll('.btn-mood').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.btn-mood').forEach(b => {
        b.style.background = 'rgba(255,255,255,0.06)';
        b.classList.remove('active');
      });
      btn.style.background = 'var(--color-primary)';
      btn.classList.add('active');
      selectedMood = btn.dataset.mood;
    });
  });

  // Word count on typing
  const textarea = container.querySelector('#journal-main-text');
  if (textarea) {
    textarea.addEventListener('input', () => updateWordCount(container));
  }

  // Toggle Entry Tag chips
  container.querySelectorAll('.btn-toggle-entry-tag').forEach((chip) => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (activeEntryTags.has(tag)) {
        activeEntryTags.delete(tag);
        chip.classList.remove('active');
      } else {
        activeEntryTags.add(tag);
        chip.classList.add('active');
      }
    });
  });

  // Add custom tag to entry
  const btnAddCustomTag = container.querySelector('#btn-add-tag-to-entry');
  const inputNewTag = container.querySelector('#input-new-custom-tag');
  if (btnAddCustomTag && inputNewTag) {
    const addTagAction = () => {
      let val = inputNewTag.value.trim();
      if (!val) return;
      if (!val.startsWith('#')) val = `#${val}`;
      activeEntryTags.add(val);
      inputNewTag.value = '';
      
      // Add chip to DOM
      const tagContainer = container.querySelector('#journal-tag-chips');
      const newChip = document.createElement('button');
      newChip.type = 'button';
      newChip.className = 'filter-chip active btn-toggle-entry-tag';
      newChip.dataset.tag = val;
      newChip.innerText = val;
      newChip.addEventListener('click', () => {
        if (activeEntryTags.has(val)) {
          activeEntryTags.delete(val);
          newChip.classList.remove('active');
        } else {
          activeEntryTags.add(val);
          newChip.classList.add('active');
        }
      });
      tagContainer.appendChild(newChip);
    };

    btnAddCustomTag.addEventListener('click', addTagAction);
    inputNewTag.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagAction();
      }
    });
  }

  // Save Journal Entry
  const btnSave = container.querySelector('#btn-save-journal-entry');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const date = container.querySelector('#journal-entry-date').value;
      const gratitudeItems = Array.from(container.querySelectorAll('.journal-gratitude-item')).map(i => i.value.trim());
      const journalText = container.querySelector('#journal-main-text').value.trim();

      if (!journalText && !gratitudeItems.some(Boolean)) {
        alert('Por favor escribe una reflexión o al menos un motivo de gratitud.');
        return;
      }

      await store.saveJournalEntry({
        date,
        gratitudeItems,
        journalText,
        tags: Array.from(activeEntryTags),
        mood: selectedMood
      });

      alert('✨ Entrada de diario guardada exitosamente. +25 XP otorgados!');
      renderJournalView(container);
    });
  }

  // Search input in history
  const searchInput = container.querySelector('#journal-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderJournalView(container);
    });
  }

  // Tag filter buttons in history
  container.querySelectorAll('.btn-filter-journal').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTagFilter = btn.dataset.tag;
      renderJournalView(container);
    });
  });

  // Load entry into editor to edit
  container.querySelectorAll('.btn-load-entry').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDateForEditor = btn.dataset.date;
      renderJournalView(container);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Delete entry
  container.querySelectorAll('.btn-delete-journal').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('¿Seguro que deseas eliminar esta entrada del diario?')) {
        await store.deleteJournalEntry(id);
        renderJournalView(container);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

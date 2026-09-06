/**
 * KIZEN CENTRAL STATE STORE (js/store.js)
 * Manages reactive data streams, 7 Pillars, Gamification state, Custom tags, and Cascading goals.
 */

import { dbManager } from './db.js';
import {
  getLogicalDate,
  DIFFICULTY_XP,
  BONUS_XP,
  updateStreakStatus,
  calculateLevelData,
  MAX_FREEZE_SHIELDS,
  FREEZE_SHIELD_COST_XP,
  sfx
} from './gamification.js';

class Store {
  constructor() {
    this.profile = null;
    this.dailyLog = null;
    this.tasks = [];
    this.weeklyGoals = [];
    this.monthlyGoals = [];
    this.projects = [];
    this.customTags = [];
    this.journalEntries = [];
    this.subscribers = new Set();
    this.currentLogicalDate = getLogicalDate();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(event, data) {
    this.subscribers.forEach((cb) => {
      try { cb(event, data); } catch (e) { console.error('Subscriber error:', e); }
    });
  }

  async init() {
    await dbManager.init();
    await this.loadInitialData();

    // Check for logical date rollover periodically (e.g. at 5:00 AM)
    setInterval(() => {
      const newDate = getLogicalDate();
      if (newDate !== this.currentLogicalDate) {
        this.currentLogicalDate = newDate;
        this.loadDailyLog().then(() => this.notify('date-rollover', newDate));
      }
    }, 60000);

    // Listen to sync updates from CouchDB
    window.addEventListener('kizen-data-synced', async () => {
      await this.loadInitialData();
      this.notify('synced-refresh');
    });
  }

  async loadInitialData() {
    this.currentLogicalDate = getLogicalDate();
    await Promise.all([
      this.loadProfile(),
      this.loadDailyLog(),
      this.loadTasks(),
      this.loadGoals(),
      this.loadProjects(),
      this.loadTags(),
      this.loadJournalEntries()
    ]);
    this.notify('initial-load-complete');
  }

  // --- Profile, Streaks & Gamification Store ---

  async refillFreezeShield(costInXp = FREEZE_SHIELD_COST_XP) {
    if (!this.profile) return { success: false, error: 'No profile found' };
    const currentTokens = this.profile.freezeTokens ?? 1;
    if (currentTokens >= MAX_FREEZE_SHIELDS) {
      return { success: false, error: `Ya alcanzaste la capacidad máxima de escudos (${MAX_FREEZE_SHIELDS}).` };
    }
    if (this.profile.totalXp < costInXp) {
      return { success: false, error: `XP insuficiente. Requiere ${costInXp} XP (tienes ${this.profile.totalXp} XP).` };
    }

    this.profile.totalXp -= costInXp;
    this.profile.freezeTokens = currentTokens + 1;
    await dbManager.putDoc(this.profile);
    sfx.playComboBonus();
    this.notify('shield-refilled', { freezeTokens: this.profile.freezeTokens, totalXp: this.profile.totalXp });
    this.notify('xp-gained', { amount: -costInXp, reason: 'Recarga de Escudo de Racha', totalXp: this.profile.totalXp });
    return { success: true, freezeTokens: this.profile.freezeTokens };
  }

  async addXp(amount, reason = '') {
    if (!this.profile) return;
    const prevLevelData = calculateLevelData(this.profile.totalXp);
    this.profile.totalXp += amount;
    const newLevelData = calculateLevelData(this.profile.totalXp);

    // Update streak on active XP gain
    const streakUpdate = updateStreakStatus(this.profile, this.currentLogicalDate, true);
    Object.assign(this.profile, streakUpdate);

    if (streakUpdate.shieldEarned) {
      this.notify('shield-earned', { freezeTokens: this.profile.freezeTokens });
    }

    await dbManager.putDoc(this.profile);

    // Level up check
    if (newLevelData.level > prevLevelData.level) {
      sfx.playLevelUp();
      if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
      this.notify('level-up', {
        oldLevel: prevLevelData.level,
        newLevel: newLevelData.level,
        rankTitle: newLevelData.rankTitle
      });
    }

    this.notify('xp-gained', { amount, reason, totalXp: this.profile.totalXp });
  }

  async loadProfile() {
    let profileDoc = await dbManager.getDoc('user_profile');
    if (!profileDoc) {
      profileDoc = {
        _id: 'user_profile',
        type: 'profile',
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        freezeTokens: 2,
        pillars: [
          {
            id: 'hygiene',
            name: 'Daily Hygiene',
            icon: '🧼',
            description: 'Personal & Space/Living Environment',
            subtext: 'Shower, tidy room, clean workspace'
          },
          {
            id: 'workout',
            name: 'Workout',
            icon: '🏋️',
            description: 'Physical Fitness & Movement',
            subtext: 'Gym, run, stretch, or calisthenics'
          },
          {
            id: 'project_work',
            name: 'Daily Project Work',
            icon: '💻',
            description: 'Active Project Focus',
            subtext: 'Project: Kizen System Launch',
            activeFocus: 'Kizen System'
          },
          {
            id: 'japanese',
            name: 'Japanese Learning',
            icon: '🗾',
            description: 'Language Study & Kanji Practice',
            subtext: 'Vocab, Wanikani, grammar or immersion'
          },
          {
            id: 'skill',
            name: 'Skill Learning',
            icon: '🎯',
            description: 'Active Skill Development',
            subtext: 'Skill: Modern Web Architecture',
            activeFocus: 'Web Architecture'
          },
          {
            id: 'mindfulness',
            name: 'Mindfulness & Stillness',
            icon: '🧘',
            description: 'Meditation & Mindful Reflection',
            subtext: '5-10m meditation, breathwork, pause'
          },
          {
            id: 'environmental_hygiene',
            name: 'Environmental Hygiene',
            icon: '🧹',
            description: 'Living Space & Desk Organization',
            subtext: 'Clean desk, tidy room, laundry & surfaces'
          }
        ]
      };
      await dbManager.putDoc(profileDoc);
    } else {
      // Migrate existing profile if needed
      let changed = false;
      profileDoc.pillars = profileDoc.pillars.map((p) => {
        if (p.id === 'wellness' || p.id === 'nutrition') {
          changed = true;
          return {
            id: 'environmental_hygiene',
            name: 'Environmental Hygiene',
            icon: '🧹',
            description: 'Living Space & Desk Organization',
            subtext: 'Clean desk, tidy room, laundry & surfaces'
          };
        }
        return p;
      });
      if (changed) {
        await dbManager.putDoc(profileDoc);
      }
    }
    this.profile = profileDoc;
  }

  // --- 7 Daily Pillars Store ---

  async loadDailyLog() {
    const docId = `daily:${this.currentLogicalDate}`;
    let doc = await dbManager.getDoc(docId);
    if (!doc) {
      doc = {
        _id: docId,
        type: 'daily_log',
        date: this.currentLogicalDate,
        pillarsCompleted: [],
        journalText: '',
        gratitudeItems: ['', '', ''],
        totalXpEarned: 0,
        comboBonusClaimed: false
      };
      await dbManager.putDoc(doc);
    }
    this.dailyLog = doc;
  }

  async togglePillar(pillarId) {
    if (!this.dailyLog) return;
    const isCompleted = this.dailyLog.pillarsCompleted.includes(pillarId);
    const pillar = this.profile.pillars.find((p) => p.id === pillarId);
    const pillarName = pillar ? pillar.name : 'Pillar';

    if (!isCompleted) {
      this.dailyLog.pillarsCompleted.push(pillarId);
      sfx.playPillarComplete();
      await this.addXp(15, `Completed ${pillarName}`);

      // Check if all 7 pillars are completed for the Combo Bonus!
      if (
        this.dailyLog.pillarsCompleted.length === this.profile.pillars.length &&
        !this.dailyLog.comboBonusClaimed
      ) {
        this.dailyLog.comboBonusClaimed = true;
        sfx.playComboBonus();
        if (typeof confetti === 'function') {
          confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
        }
        await this.addXp(BONUS_XP.PILLAR_COMBO, '7-Pillar Daily Combo Bonus!');
        this.notify('combo-achieved');
      }
    } else {
      this.dailyLog.pillarsCompleted = this.dailyLog.pillarsCompleted.filter((id) => id !== pillarId);
      this.profile.totalXp = Math.max(0, this.profile.totalXp - 15);
      await dbManager.putDoc(this.profile);
    }

    await dbManager.putDoc(this.dailyLog);
    this.notify('daily-log-updated', this.dailyLog);
  }

  async updatePillarActiveFocus(pillarId, newFocus) {
    const pillar = this.profile.pillars.find((p) => p.id === pillarId);
    if (pillar) {
      pillar.activeFocus = newFocus;
      pillar.subtext = `${pillar.name.includes('Project') ? 'Project' : 'Skill'}: ${newFocus}`;
      await dbManager.putDoc(this.profile);
      this.notify('pillars-updated', this.profile.pillars);
    }
  }

  async getPillarConsistencyStats() {
    if (!this.profile) return [];
    const allDailyLogs = await dbManager.getAllDocsByType('daily_log');
    const totalDaysRecorded = Math.max(1, allDailyLogs.length);

    return this.profile.pillars.map((pillar) => {
      const daysCompleted = allDailyLogs.filter(
        (log) => Array.isArray(log.pillarsCompleted) && log.pillarsCompleted.includes(pillar.id)
      ).length;
      const percentage = Math.round((daysCompleted / totalDaysRecorded) * 100);

      return {
        id: pillar.id,
        name: pillar.name,
        icon: pillar.icon,
        daysCompleted,
        totalDaysRecorded,
        percentage
      };
    });
  }

  // --- Dedicated Journal & Gratitude Store ---

  async loadJournalEntries() {
    this.journalEntries = await dbManager.getAllDocsByType('journal_entry');
    this.journalEntries.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }

  async saveJournalEntry(entryData) {
    const entryDate = entryData.date || this.currentLogicalDate;
    const existing = this.journalEntries.find((e) => e.date === entryDate || (entryData._id && e._id === entryData._id));
    const isNew = !existing;

    const doc = {
      _id: existing?._id || `journal_entry:${entryDate}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'journal_entry',
      date: entryDate,
      gratitudeItems: entryData.gratitudeItems || ['', '', ''],
      journalText: entryData.journalText || '',
      tags: entryData.tags || [],
      mood: entryData.mood || 'neutral',
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    const savedDoc = await dbManager.putDoc(doc);

    // Sync with this.dailyLog if it is for today
    if (entryDate === this.currentLogicalDate && this.dailyLog) {
      this.dailyLog.journalText = doc.journalText;
      this.dailyLog.gratitudeItems = doc.gratitudeItems;
      await dbManager.putDoc(this.dailyLog);
      this.notify('daily-log-updated', this.dailyLog);
    }

    if (isNew && (doc.journalText || doc.gratitudeItems.some(Boolean))) {
      sfx.playTaskComplete();
      await this.addXp(BONUS_XP.JOURNAL_SAVED, 'Entrada de Diario y Reflexión Guardada');
    }

    await this.loadJournalEntries();
    this.notify('journal-updated', this.journalEntries);
    return savedDoc;
  }

  async deleteJournalEntry(entryId) {
    await dbManager.removeDoc(entryId);
    this.journalEntries = this.journalEntries.filter((e) => e._id !== entryId);
    this.notify('journal-updated', this.journalEntries);
  }

  async saveReflection(journalText, gratitudeItems) {
    return await this.saveJournalEntry({
      date: this.currentLogicalDate,
      journalText,
      gratitudeItems,
      tags: ['#diario']
    });
  }

  // --- Tasks & Action Items Store ---

  async loadTasks() {
    this.tasks = await dbManager.getAllDocsByType('task');
    this.tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async addTask(taskData) {
    const difficulty = taskData.difficulty || 'easy';
    const xpReward = DIFFICULTY_XP[difficulty] || 25;
    const newTask = {
      _id: `task:${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'task',
      title: taskData.title.trim(),
      description: taskData.description || '',
      difficulty,
      xpAwarded: xpReward,
      tags: taskData.tags || [],
      dueDate: taskData.dueDate || '',
      scheduledDate: taskData.scheduledDate || this.currentLogicalDate,
      projectId: taskData.projectId || null,
      activityId: taskData.activityId || null,
      weeklyGoalId: taskData.weeklyGoalId || null,
      isCompleted: false,
      isOptional: !!taskData.isOptional,
      createdAt: new Date().toISOString(),
      order: this.tasks.length + 1
    };

    const doc = await dbManager.putDoc(newTask);
    this.tasks.unshift(doc);
    this.notify('tasks-updated', this.tasks);
    return doc;
  }

  async toggleTask(taskId) {
    const task = this.tasks.find((t) => t._id === taskId);
    if (!task) return;

    task.isCompleted = !task.isCompleted;
    task.completedAt = task.isCompleted ? new Date().toISOString() : null;

    if (task.isCompleted) {
      sfx.playTaskComplete();
      await this.addXp(task.xpAwarded, `Completed: ${task.title}`);
    } else {
      this.profile.totalXp = Math.max(0, this.profile.totalXp - task.xpAwarded);
      await dbManager.putDoc(this.profile);
    }

    await dbManager.putDoc(task);
    this.notify('tasks-updated', this.tasks);
  }

  async deleteTask(taskId) {
    await dbManager.removeDoc(taskId);
    this.tasks = this.tasks.filter((t) => t._id !== taskId);
    this.notify('tasks-updated', this.tasks);
  }

  async rolloverTaskToToday(taskId) {
    const task = this.tasks.find((t) => t._id === taskId);
    if (task) {
      task.scheduledDate = this.currentLogicalDate;
      await dbManager.putDoc(task);
      this.notify('tasks-updated', this.tasks);
    }
  }

  // --- Custom Tags Store ---

  async loadTags() {
    let tagsDoc = await dbManager.getDoc('custom_tags');
    if (!tagsDoc) {
      tagsDoc = {
        _id: 'custom_tags',
        type: 'tag_list',
        tags: [
          { id: 'coding', label: '#coding', color: '#0ea5e9' },
          { id: 'japanese', label: '#japanese', color: '#f43f5e' },
          { id: 'fitness', label: '#fitness', color: '#10b981' },
          { id: 'deepwork', label: '#deepwork', color: '#f59e0b' },
          { id: 'admin', label: '#admin', color: '#64748b' },
          { id: 'learning', label: '#learning', color: '#8b5cf6' }
        ]
      };
      await dbManager.putDoc(tagsDoc);
    }
    this.customTags = tagsDoc.tags;
  }

  async addCustomTag(label, color = '#38bdf8') {
    const cleanLabel = label.startsWith('#') ? label : `#${label.trim()}`;
    const id = cleanLabel.replace('#', '').toLowerCase().replace(/\s+/g, '-');
    if (this.customTags.some((t) => t.id === id)) return;

    this.customTags.push({ id, label: cleanLabel, color });
    await dbManager.putDoc({
      _id: 'custom_tags',
      type: 'tag_list',
      tags: this.customTags
    });
    this.notify('tags-updated', this.customTags);
  }

  async deleteCustomTag(tagId) {
    this.customTags = this.customTags.filter((t) => t.id !== tagId);
    await dbManager.putDoc({
      _id: 'custom_tags',
      type: 'tag_list',
      tags: this.customTags
    });
    this.notify('tags-updated', this.customTags);
  }

  // --- Goals (Weekly & Monthly) Store ---

  async loadGoals() {
    const allGoals = await dbManager.getAllDocsByType('goal');
    this.weeklyGoals = allGoals.filter((g) => g.period === 'weekly');
    this.monthlyGoals = allGoals.filter((g) => g.period === 'monthly');
  }

  async addGoal(goalData) {
    const newGoal = {
      _id: `goal:${goalData.period}:${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'goal',
      period: goalData.period, // 'weekly' | 'monthly'
      title: goalData.title.trim(),
      description: goalData.description || '',
      parentMonthlyGoalId: goalData.parentMonthlyGoalId || null,
      projectId: goalData.projectId || null,
      progress: 0,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };

    const doc = await dbManager.putDoc(newGoal);
    if (newGoal.period === 'weekly') {
      this.weeklyGoals.unshift(doc);
    } else {
      this.monthlyGoals.unshift(doc);
    }
    this.notify('goals-updated');
    return doc;
  }

  async toggleGoalComplete(goalId) {
    const goal = [...this.weeklyGoals, ...this.monthlyGoals].find((g) => g._id === goalId);
    if (!goal) return;

    goal.isCompleted = !goal.isCompleted;
    goal.progress = goal.isCompleted ? 100 : 0;

    if (goal.isCompleted) {
      sfx.playComboBonus();
      const bonus = goal.period === 'monthly' ? BONUS_XP.MONTHLY_GOAL_MET : BONUS_XP.WEEKLY_GOAL_MET;
      await this.addXp(bonus, `Achieved ${goal.period} Goal: ${goal.title}`);
    }

    await dbManager.putDoc(goal);
    this.notify('goals-updated');
  }

  async deleteGoal(goalId) {
    await dbManager.removeDoc(goalId);
    this.weeklyGoals = this.weeklyGoals.filter((g) => g._id !== goalId);
    this.monthlyGoals = this.monthlyGoals.filter((g) => g._id !== goalId);
    this.notify('goals-updated');
  }

  // --- Projects & Nested Activities Store ---

  async loadProjects() {
    let projects = await dbManager.getAllDocsByType('project');
    if (projects.length === 0) {
      // Seed initial default projects
      const defaultProject = {
        _id: 'project:kizen_launch',
        type: 'project',
        name: 'Kizen Productivity System',
        category: 'Development',
        description: 'Building and mastering personal productivity & learning workflow',
        status: 'active',
        activities: [
          { id: 'act_1', title: 'PWA Mobile & Desktop Setup', isCompleted: true },
          { id: 'act_2', title: '7 Pillars Mastery Routine', isCompleted: false },
          { id: 'act_3', title: 'CouchDB Home Sync Integration', isCompleted: false }
        ],
        createdAt: new Date().toISOString()
      };
      await dbManager.putDoc(defaultProject);
      projects = [defaultProject];
    }
    this.projects = projects;
  }

  async addProject(projectData) {
    const newProject = {
      _id: `project:${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'project',
      name: projectData.name.trim(),
      category: projectData.category || 'General',
      description: projectData.description || '',
      status: 'active',
      activities: (projectData.activities || []).map((a, i) => ({
        id: `act_${Date.now()}_${i}`,
        title: typeof a === 'string' ? a : a.title,
        isCompleted: false
      })),
      createdAt: new Date().toISOString()
    };

    const doc = await dbManager.putDoc(newProject);
    this.projects.unshift(doc);
    this.notify('projects-updated', this.projects);
    return doc;
  }

  async updateProject(project) {
    await dbManager.putDoc(project);
    const idx = this.projects.findIndex((p) => p._id === project._id);
    if (idx !== -1) {
      this.projects[idx] = project;
    }
    this.notify('projects-updated', this.projects);
  }

  async toggleActivityComplete(projectId, activityId) {
    const project = this.projects.find((p) => p._id === projectId);
    if (!project) return;
    const act = project.activities.find((a) => a.id === activityId);
    if (!act) return;

    act.isCompleted = !act.isCompleted;
    if (act.isCompleted) {
      sfx.playTaskComplete();
      await this.addXp(30, `Completed Activity: ${act.title}`);
    }

    await dbManager.putDoc(project);
    this.notify('projects-updated', this.projects);
  }

  async deleteProject(projectId) {
    await dbManager.removeDoc(projectId);
    this.projects = this.projects.filter((p) => p._id !== projectId);
    if (this.profile?.activeProjectId === projectId) {
      const nextProj = this.projects[0];
      await this.setActiveProject(nextProj ? nextProj._id : null);
    }
    this.notify('projects-updated', this.projects);
  }

  async setActiveProject(projectId) {
    if (!this.profile) return;
    this.profile.activeProjectId = projectId;
    const project = this.projects.find((p) => p._id === projectId);
    const projName = project ? project.name : 'General Work';

    // Automatically update the 3rd Pillar (Daily Project Work)
    const pillar = this.profile.pillars.find((p) => p.id === 'project_work');
    if (pillar) {
      pillar.activeFocus = projName;
      pillar.subtext = `Project: ${projName}`;
    }

    await dbManager.putDoc(this.profile);
    this.notify('active-project-updated', project);
    this.notify('pillars-updated', this.profile.pillars);
  }

  getActiveProject() {
    if (!this.projects || this.projects.length === 0) return null;
    const id = this.profile?.activeProjectId;
    if (id) {
      const found = this.projects.find((p) => p._id === id);
      if (found) return found;
    }
    return this.projects[0];
  }

  getActiveProjects() {
    if (!this.projects || this.projects.length === 0) return [];
    return this.projects.filter((p) => p.status !== 'archived');
  }

  // --- Smart "Pull Next Task" Engine ---
  getSuggestedNextTask() {
    // 1. High priority uncompleted task scheduled for today
    const todayUncompleted = this.tasks.find(
      (t) => !t.isCompleted && !t.isOptional && (t.scheduledDate === this.currentLogicalDate || !t.scheduledDate)
    );
    if (todayUncompleted) return todayUncompleted;

    // 2. Uncompleted activity from active project
    const activeProj = this.getActiveProject();
    if (activeProj) {
      const openActivity = activeProj.activities?.find((a) => !a.isCompleted);
      if (openActivity) {
        return {
          title: `${openActivity.title} (${activeProj.name})`,
          isProjectActivity: true,
          projectId: activeProj._id,
          activityId: openActivity.id
        };
      }
    }

    // 3. Fallback
    return null;
  }
}

export const store = new Store();


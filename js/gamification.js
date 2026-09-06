/**
 * KIZEN GAMIFICATION & LOGICAL DATE ENGINE
 * Handles XP rewards, Level scaling, Streak calculations (5 AM Reset), and Sound FX.
 */

// Difficulty XP Scale
export const DIFFICULTY_XP = {
  trivial: 10,
  easy: 25,
  medium: 50,
  hard: 100,
  epic: 250
};

export const BONUS_XP = {
  PILLAR_COMBO: 50,
  JOURNAL_SAVED: 25,
  WEEKLY_GOAL_MET: 150,
  MONTHLY_GOAL_MET: 500,
  BREAKDOWN_BONUS: 75
};

export const MAX_FREEZE_SHIELDS = 3;
export const FREEZE_SHIELD_COST_XP = 100;

// Level Progression Titles
export const LEVEL_RANKS = [
  { level: 1, title: 'Initiate' },
  { level: 2, title: 'Novice Practitioner' },
  { level: 4, title: 'Focus Apprentice' },
  { level: 6, title: 'Disciplined Operator' },
  { level: 8, title: 'Strategic Adept' },
  { level: 11, title: 'Flow Specialist' },
  { level: 15, title: 'Grand Strategist' },
  { level: 20, title: 'Productivity Sovereign' },
  { level: 30, title: 'Ascendant Luminary' }
];

/**
 * Calculates the logical date considering the 5:00 AM day reset boundary.
 * If the current time is between 00:00 and 04:59, it belongs to the previous day.
 */
export function getLogicalDate(date = new Date(), resetHour = 5) {
  const d = new Date(date);
  if (d.getHours() < resetHour) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns formatted human date e.g. "Tuesday, Aug 18"
 */
export function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Level & XP Math
 * Formula: Level = floor(sqrt(totalXP / 100)) + 1
 * Next Level XP = (Level)^2 * 100
 */
export function calculateLevelData(totalXp = 0) {
  const level = Math.floor(Math.sqrt(Math.max(0, totalXp) / 100)) + 1;
  const currentLevelBaseXp = Math.pow(level - 1, 2) * 100;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const xpIntoCurrentLevel = totalXp - currentLevelBaseXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelBaseXp;
  const progressPercent = Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpNeededForNextLevel) * 100));

  let rankTitle = 'Initiate';
  for (const rank of LEVEL_RANKS) {
    if (level >= rank.level) {
      rankTitle = rank.title;
    }
  }

  return {
    level,
    totalXp,
    currentLevelBaseXp,
    nextLevelXp,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    progressPercent: Math.round(progressPercent),
    rankTitle
  };
}

/**
 * Streak Calculation Engine with 5:00 AM day boundary & freeze mechanics
 */
export function updateStreakStatus(profile, todayLogicalDate, wasActiveToday = true) {
  const lastActive = profile.lastActiveDate;
  if (!lastActive) {
    return {
      currentStreak: wasActiveToday ? 1 : 0,
      longestStreak: wasActiveToday ? 1 : 0,
      lastActiveDate: wasActiveToday ? todayLogicalDate : null,
      freezeTokens: profile.freezeTokens ?? 1
    };
  }

  if (lastActive === todayLogicalDate) {
    return {
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      lastActiveDate: todayLogicalDate,
      freezeTokens: profile.freezeTokens ?? 1
    };
  }

  // Calculate day difference between today and lastActive
  const d1 = new Date(lastActive);
  const d2 = new Date(todayLogicalDate);
  const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

  let currentStreak = profile.currentStreak || 0;
  let freezeTokens = profile.freezeTokens ?? 1;
  const oldStreak = profile.currentStreak || 0;

  if (diffDays === 1) {
    // Consecutive day
    if (wasActiveToday) {
      currentStreak += 1;
    }
  } else if (diffDays === 2 && freezeTokens > 0) {
    // Missed 1 day, consumed 1 freeze token
    freezeTokens -= 1;
    if (wasActiveToday) {
      currentStreak += 1;
    }
  } else if (diffDays > 1) {
    // Broken streak
    currentStreak = wasActiveToday ? 1 : 0;
  }

  // Automatic refill: When reaching any multiple of 7 consecutive days, earn +1 Freeze Shield (up to max capacity 3)
  let shieldEarned = false;
  if (currentStreak > 0 && currentStreak % 7 === 0 && currentStreak > oldStreak) {
    if (freezeTokens < MAX_FREEZE_SHIELDS) {
      freezeTokens += 1;
      shieldEarned = true;
    }
  }

  const longestStreak = Math.max(profile.longestStreak || 0, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: wasActiveToday ? todayLogicalDate : lastActive,
    freezeTokens,
    shieldEarned
  };
}

/**
 * Web Audio API Gamification Sound Synthesizer
 * Plays crisp, modern audio chimes without any external file dependencies.
 */
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTaskComplete() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);
    } catch (e) {}
  }

  playPillarComplete() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {}
  }

  playComboBonus() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (i * 0.08));
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + (i * 0.08));
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (i * 0.08) + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + (i * 0.08));
        osc.stop(this.ctx.currentTime + (i * 0.08) + 0.25);
      });
    } catch (e) {}
  }

  playLevelUp() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (i * 0.1));
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime + (i * 0.1));
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (i * 0.1) + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + (i * 0.1));
        osc.stop(this.ctx.currentTime + (i * 0.1) + 0.35);
      });
    } catch (e) {}
  }
}

export const sfx = new SoundEffects();

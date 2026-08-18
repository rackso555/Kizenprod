/**
 * KIZEN NOTIFICATION & REVIEW REMINDER ENGINE (js/notifications.js)
 * Manages Web Notifications, permission workflows, and scheduled review prompts.
 */

class NotificationEngine {
  constructor() {
    this.settings = this.loadSettings();
    this.timer = null;
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('kizen_notification_settings');
      return saved ? JSON.parse(saved) : {
        enabled: false,
        dailyReminderTime: '09:00',
        weeklyReviewDay: 0, // 0 = Sunday
        weeklyReviewTime: '18:00',
        monthlyReviewDay: 1, // 1st of month
        monthlyReviewTime: '10:00'
      };
    } catch (e) {
      return { enabled: false };
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('kizen_notification_settings', JSON.stringify(this.settings));
    this.initScheduler();
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      alert('This browser does not support web notifications.');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.saveSettings({ enabled: true });
      return true;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      this.saveSettings({ enabled: true });
      this.sendNotification('⚡ Kizen Notifications Activated', {
        body: 'You will receive reminders for Weekly and Monthly reviews.'
      });
      return true;
    } else {
      this.saveSettings({ enabled: false });
      return false;
    }
  }

  sendNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const defaultOptions = {
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200]
    };

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, { ...defaultOptions, ...options });
        });
      } else {
        new Notification(title, { ...defaultOptions, ...options });
      }
    } catch (e) {
      console.warn('Notification error:', e);
    }
  }

  initScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Check periodically every 60 seconds
    this.timer = setInterval(() => {
      this.checkScheduledReminders();
    }, 60000);

    this.checkScheduledReminders();
  }

  checkScheduledReminders() {
    if (!this.settings.enabled || Notification.permission !== 'granted') {
      return;
    }

    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday
    const currentDate = now.getDate(); // 1-31
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    const lastTriggered = localStorage.getItem('kizen_last_notification_trigger');
    const triggerKey = `${now.toISOString().slice(0, 10)}_${currentTimeStr}`;

    if (lastTriggered === triggerKey) {
      return; // Already triggered in this minute
    }

    // 1. Weekly Review Reminder (e.g. Sunday 18:00)
    if (currentDayOfWeek === Number(this.settings.weeklyReviewDay) && currentTimeStr === this.settings.weeklyReviewTime) {
      this.sendNotification('📅 Time for your Weekly Review!', {
        body: 'Check off your sprint achievements and plan next week in Kizen.'
      });
      localStorage.setItem('kizen_last_notification_trigger', triggerKey);
    }

    // 2. Monthly Review Reminder (e.g. 1st of month 10:00)
    if (currentDate === Number(this.settings.monthlyReviewDay) && currentTimeStr === this.settings.monthlyReviewTime) {
      this.sendNotification('🗓️ Monthly Alignment & Goal Review', {
        body: 'Review your monthly OKRs and set this month\'s vision!'
      });
      localStorage.setItem('kizen_last_notification_trigger', triggerKey);
    }
  }
}

export const notificationEngine = new NotificationEngine();

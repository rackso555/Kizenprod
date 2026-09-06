/**
 * KIZEN NOTIFICATION & REVIEW REMINDER ENGINE (js/notifications.js)
 * Manages Web Notifications, permission workflows, service worker display, and scheduled review prompts.
 */

class NotificationEngine {
  constructor() {
    this.settings = this.loadSettings();
    this.timer = null;
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('kizen_notification_settings');
      const defaults = {
        enabled: false,
        dailyReminderEnabled: true,
        dailyReminderTime: '09:00',
        weeklyReviewDay: 0, // 0 = Sunday
        weeklyReviewTime: '18:00',
        monthlyReviewDay: 1, // 1st of month
        monthlyReviewTime: '10:00'
      };
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (e) {
      return {
        enabled: false,
        dailyReminderEnabled: true,
        dailyReminderTime: '09:00',
        weeklyReviewDay: 0,
        weeklyReviewTime: '18:00',
        monthlyReviewDay: 1,
        monthlyReviewTime: '10:00'
      };
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('kizen_notification_settings', JSON.stringify(this.settings));
    this.initScheduler();
    return this.settings;
  }

  async toggleEnabled() {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones web.');
      return false;
    }

    if (this.settings.enabled) {
      this.saveSettings({ enabled: false });
      return false;
    }

    if (Notification.permission === 'granted') {
      this.saveSettings({ enabled: true });
      this.sendNotification('⚡ Notificaciones Kizen Activadas', {
        body: 'Recordatorios diarios y revisiones programadas correctamente.'
      });
      return true;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      this.saveSettings({ enabled: true });
      this.sendNotification('⚡ Notificaciones Kizen Activadas', {
        body: 'Recordatorios diarios y revisiones programadas correctamente.'
      });
      return true;
    } else {
      this.saveSettings({ enabled: false });
      alert('El permiso para notificaciones no fue concedido en tu navegador.');
      return false;
    }
  }

  async requestPermission() {
    return await this.toggleEnabled();
  }

  sendNotification(title, options = {}) {
    // In-app visual notification fallback always triggers
    window.dispatchEvent(new CustomEvent('kizen-show-toast', {
      detail: { message: `🔔 ${title}: ${options.body || ''}`, type: 'xp' }
    }));

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const defaultOptions = {
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'kizen-notification'
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, finalOptions);
        }).catch(() => {
          try { new Notification(title, finalOptions); } catch (err) {}
        });
      } else {
        new Notification(title, finalOptions);
      }
    } catch (e) {
      console.warn('Notification error:', e);
    }
  }

  initScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Check periodically every 45 seconds
    this.timer = setInterval(() => {
      this.checkScheduledReminders();
    }, 45000);

    this.checkScheduledReminders();
  }

  checkScheduledReminders() {
    if (!this.settings.enabled) {
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

    // 1. Daily Morning Prompt (e.g. 09:00)
    if (this.settings.dailyReminderEnabled && currentTimeStr === this.settings.dailyReminderTime) {
      this.sendNotification('☀️ Buenos Días: Pilares Kizen', {
        body: 'Revisa tus 7 pilares diarios y misiones prioritarias de hoy.'
      });
      localStorage.setItem('kizen_last_notification_trigger', triggerKey);
      return;
    }

    // 2. Weekly Review Reminder (e.g. Sunday 18:00)
    if (currentDayOfWeek === Number(this.settings.weeklyReviewDay) && currentTimeStr === this.settings.weeklyReviewTime) {
      this.sendNotification('📅 Momento de tu Revisión Semanal', {
        body: 'Revisa los logros del sprint y planifica tus objetivos para la próxima semana.'
      });
      localStorage.setItem('kizen_last_notification_trigger', triggerKey);
      return;
    }

    // 3. Monthly Review Reminder (e.g. 1st of month 10:00)
    if (currentDate === Number(this.settings.monthlyReviewDay) && currentTimeStr === this.settings.monthlyReviewTime) {
      this.sendNotification('🗓️ Alineación y Visión Mensual', {
        body: 'Revisa tus OKRs mensuales y define las metas clave de este mes.'
      });
      localStorage.setItem('kizen_last_notification_trigger', triggerKey);
      return;
    }
  }
}

export const notificationEngine = new NotificationEngine();

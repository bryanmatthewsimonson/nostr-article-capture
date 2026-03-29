import { CONFIG } from './config.js';

export const Utils = {
  // HTML escape to prevent XSS when inserting user text into innerHTML
  escapeHtml: (str) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  // Show toast notification
  showToast: (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = 'nac-toast nac-toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('visible'), 100);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // Log with prefix
  log: (...args) => {
    if (CONFIG.debug) {
      console.log('[NAC]', ...args);
    }
  },

  // Error log
  error: (...args) => {
    console.error('[NAC]', ...args);
  },

  // Make a non-button element keyboard-accessible (Enter/Space triggers click)
  makeKeyboardAccessible: (el) => {
    if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.getAttribute('role')) el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  }
};

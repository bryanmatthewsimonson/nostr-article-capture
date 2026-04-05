import { Storage } from './storage.js';

export const PendingCaptures = {
  save: async (captureData) => {
    const pending = await Storage.get('pending_captures', []);
    pending.push({
      ...captureData,
      savedAt: Date.now(),
      status: 'pending'
    });
    await Storage.set('pending_captures', pending);
    return pending.length;
  },

  getAll: async () => {
    return await Storage.get('pending_captures', []);
  },

  remove: async (index) => {
    const pending = await Storage.get('pending_captures', []);
    pending.splice(index, 1);
    await Storage.set('pending_captures', pending);
  },

  clear: async () => {
    await Storage.set('pending_captures', []);
  },

  getCount: async () => {
    const pending = await Storage.get('pending_captures', []);
    return pending.length;
  }
};

import { create } from 'zustand';
import { authAPI } from '../api';

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,

  init: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return set({ loading: false });
    try {
      const { data } = await authAPI.getMe();
      if (data.user.role !== 'admin') {
        localStorage.clear();
        return set({ loading: false, isAuthenticated: false });
      }
      set({ user: data.user, isAuthenticated: true, loading: false });
    } catch {
      localStorage.clear();
      set({ loading: false, isAuthenticated: false });
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login({ email, password, deviceId: 'admin-panel' });
    if (data.user.role !== 'admin') throw new Error('Not authorized as admin');
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    const refresh = localStorage.getItem('refreshToken');
    try { await authAPI.logout(refresh); } catch {}
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },
}));

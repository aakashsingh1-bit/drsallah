import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({ baseURL: API_BASE });

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getStats: () => api.get('/admin/dashboard'),
  getUserGrowth: () => api.get('/admin/analytics/users'),
  getVideoAnalytics: () => api.get('/admin/analytics/videos'),
  getRevenue: () => api.get('/admin/revenue'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getAll: (params) => api.get('/admin/users', { params }),
  getById: (id) => api.get(`/admin/users/${id}`),
  update: (id, data) => api.put(`/admin/users/${id}`, data),
  delete: (id) => api.delete(`/admin/users/${id}`),
  suspend: (id, reason) => api.post(`/admin/users/${id}/suspend`, { reason }),
  unsuspend: (id) => api.post(`/admin/users/${id}/unsuspend`),
  forceLogout: (id) => api.post(`/admin/users/${id}/force-logout`),
  resetDevice: (id) => api.post(`/auth/reset-device/${id}`),
  getFlagged: () => api.get('/admin/security/flagged-users'),
};

// ── Courses ───────────────────────────────────────────────────────────────────
export const coursesAPI = {
  getAll: (params) => api.get('/courses', { params }),
  getById: (id) => api.get(`/courses/${id}`),
  create: (formData) => api.post('/courses', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/courses/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/courses/${id}`),
  uploadThumbnail: (courseId, formData) =>
    api.post(`/courses/${courseId}/thumbnail`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ── Modules ───────────────────────────────────────────────────────────────────
export const modulesAPI = {
  getByCourse: (courseId) => api.get(`/courses/${courseId}/modules`),
  create: (courseId, data) => api.post(`/courses/${courseId}/modules`, data),
  update: (id, data) => api.put(`/modules/${id}`, data),
  delete: (id) => api.delete(`/modules/${id}`),
  reorder: (orders) => api.post('/modules/reorder', { orders }),
};

// ── Lessons ───────────────────────────────────────────────────────────────────
export const lessonsAPI = {
  getByModule: (moduleId) => api.get(`/modules/${moduleId}/lessons`),
  getById: (id) => api.get(`/lessons/${id}`),
  create: (moduleId, data) => api.post(`/modules/${moduleId}/lessons`, data),
  update: (id, data) => api.put(`/lessons/${id}`, data),
  delete: (id) => api.delete(`/lessons/${id}`),
  reorder: (orders) => api.post('/lessons/reorder', { orders }),
};

// ── Video Upload ──────────────────────────────────────────────────────────────
export const videoAPI = {
  getPresignedUrl: (data) => api.post('/videos/presigned-upload', data),
  confirmUpload: (data) => api.post('/videos/confirm', data),
  uploadDirect: (lessonId, formData, onProgress) =>
    api.post(`/videos/upload/${lessonId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
    }),
  // Upload directly to S3 using presigned URL
  uploadToS3: (presignedUrl, file, onProgress) =>
    axios.put(presignedUrl, file, {
      headers: { 'Content-Type': file.type || 'video/mp4' },
      onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
    }),
  // ── Direct Browser-to-S3 Multipart Upload (like YouTube) ──────────────
  // Browser splits file into 10MB chunks, uploads each directly to S3 via
  // presigned URLs. Server only handles init/complete — zero server bandwidth.
  initMultipartUpload: (data) => api.post('/videos/direct-multipart/init', data),
  completeMultipartUpload: (data) => api.post('/videos/direct-multipart/complete', data),
  abortMultipartUpload: (data) => api.post('/videos/direct-multipart/abort', data),
};

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const subscriptionsAPI = {
  getAll: (params) => api.get('/admin/subscriptions', { params }),
  getRevenue: () => api.get('/admin/revenue'),
  getPlans: () => api.get('/plans'),
  createPlan: (data) => api.post('/plans', data),
  updatePlan: (id, data) => api.put(`/plans/${id}`, data),
  deletePlan: (id) => api.delete(`/plans/${id}`),
};

// ── Security ──────────────────────────────────────────────────────────────────
export const securityAPI = {
  getLogs: (params) => api.get('/admin/security/logs', { params }),
  resolveLog: (id) => api.post(`/admin/security/logs/${id}/resolve`),
  getFlagged: () => api.get('/admin/security/flagged-users'),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  broadcast: (data) => api.post('/admin/notifications/broadcast', data),
};

// ── Course Purchases ────────────────────────────────────────────
export const purchasesAPI = {
  getAll: (params) => api.get('/admin/course-purchases', { params }),
  getMy: () => api.get('/course-purchases/my'),
  createCheckout: (courseId, data) => api.post(`/courses/${courseId}/purchase/checkout`, data),
  createPaymentIntent: (courseId, data) => api.post(`/courses/${courseId}/purchase/payment-intent`, data),
  confirmPayment: (courseId, data) => api.post(`/courses/${courseId}/purchase/confirm`, data),
};

// ── Course Reviews ──────────────────────────────────────────────
export const reviewsAPI = {
  create: (courseId, data) => api.post(`/courses/${courseId}/review`, data),
  getByCourse: (courseId, params) => api.get(`/courses/${courseId}/reviews`, { params }),
  getMy: (courseId) => api.get(`/courses/${courseId}/my-review`),
  getAllAdmin: (params) => api.get('/admin/course-reviews', { params }),
  approve: (reviewId) => api.post(`/admin/course-reviews/${reviewId}/approve`),
  delete: (reviewId) => api.delete(`/admin/course-reviews/${reviewId}`),
};

// ── Gallery ──────────────────────────────────────────────────────
export const galleryAPI = {
  getAll: (params) => api.get('/gallery', { params }),
  getById: (id) => api.get(`/gallery/${id}`),
  upload: (formData) => api.post('/gallery', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadBulk: (formData) => api.post('/gallery/bulk', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/gallery/${id}`, data),
  deleteImage: (id) => api.delete(`/gallery/${id}`),
};

export default api;

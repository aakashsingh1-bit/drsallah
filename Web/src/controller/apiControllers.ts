import { api } from "@/apiConfig/client";
import { ENDPOINTS, withParams } from "@/apiConfig/endpoints";

export const UserAuthController = {
  login(email: string, password: string) {
    return api(ENDPOINTS.LOGIN, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  loginOtp(email: string) {
    return api(ENDPOINTS.LOGIN_OTP_SEND, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  verifyLoginOtp(email: string, otp: string) {
    return api(ENDPOINTS.LOGIN_OTP_VERIFY, {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  },
  register(name: string, email: string, password: string, phone: string) {
    return api(ENDPOINTS.REGISTER, {
      method: "POST",
      body: JSON.stringify({ name, email, password, phone }),
    });
  },
  verifyOtp(otp: string, userId: string) {
    return api(ENDPOINTS.VERIFY_OTP, {
      method: "POST",
      body: JSON.stringify({ otp, userId }),
    });
  },
  resendOtp(payload: { email?: string; userId?: string }) {
    return api(ENDPOINTS.RESEND_OTP, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  registrationStatus(email: string) {
    return api(`${ENDPOINTS.REGISTRATION_STATUS}?email=${encodeURIComponent(email)}`, {
      method: "GET",
    });
  },
  forgotPassword(email: string) {
    return api(ENDPOINTS.FORGOT_PASSWORD, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(newPassword: string, otp: string, userId: string) {
    return api(ENDPOINTS.RESET_PASSWORD, {
      method: "POST",
      body: JSON.stringify({ newPassword, otp, userId }),
    });
  },
  getProfile() {
    return api(ENDPOINTS.GET_PROFILE, { method: "GET" });
  },
  updateProfile(body: Record<string, string>) {
    return api(ENDPOINTS.UPDATE_PROFILE, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  logout() {
    const refreshToken = localStorage.getItem("eduRefreshToken");
    return api(ENDPOINTS.LOGOUT, {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },
  deleteAccount() {
    return api(ENDPOINTS.DELETE_ACCOUNT, { method: "DELETE" });
  },
};

export const CourseController = {
  getCourses(params?: { search?: string; category?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.category) q.set("category", params.category);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return api(`${ENDPOINTS.GET_COURSES}${qs ? `?${qs}` : ""}`, { method: "GET" });
  },
  getCourse(id: string) {
    return api(withParams(ENDPOINTS.GET_COURSE, { id }), { method: "GET" });
  },
  getCourseContent(id: string) {
    return api(withParams(ENDPOINTS.GET_COURSE_CONTENT, { id }), { method: "GET" });
  },
  getMyLearning() {
    return api(ENDPOINTS.GET_MY_LEARNING, { method: "GET" });
  },
  getModules(courseId: string) {
    return api(withParams(ENDPOINTS.GET_MODULES, { id: courseId }), { method: "GET" });
  },
  getModuleLessons(moduleId: string) {
    return api(withParams(ENDPOINTS.GET_MODULE_LESSONS, { moduleId }), { method: "GET" });
  },
  getLesson(lessonId: string) {
    return api(withParams(ENDPOINTS.GET_LESSON, { id: lessonId }), { method: "GET" });
  },
  getLessonStream(lessonId: string) {
    return api(withParams(ENDPOINTS.GET_LESSON_STREAM, { lessonId }), { method: "GET" });
  },
  getFreeLessonStream(lessonId: string) {
    return api(withParams(ENDPOINTS.GET_LESSON_FREE_STREAM, { lessonId }), { method: "GET" });
  },
  getWatchHistory() {
    return api(ENDPOINTS.WATCH_HISTORY, { method: "GET" });
  },
  updateWatchHistory(lessonId: string, progress: number) {
    return api(ENDPOINTS.WATCH_HISTORY, {
      method: "POST",
      body: JSON.stringify({ lessonId, progress }),
    });
  },
  submitReview(courseId: string, rating: number, comment?: string) {
    return api(withParams(ENDPOINTS.SUBMIT_REVIEW, { courseId }), {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    });
  },
  getMyReview(courseId: string) {
    return api(withParams(ENDPOINTS.MY_REVIEW, { courseId }), { method: "GET" });
  },
  getCourseReviews(courseId: string, page = 1) {
    return api(`${withParams(ENDPOINTS.COURSE_REVIEWS, { courseId })}?page=${page}`, { method: "GET" });
  },
  getBookmarks() {
    return api(ENDPOINTS.BOOKMARKS, { method: "GET" });
  },
  toggleBookmark(lessonId: string) {
    return api(withParams(ENDPOINTS.TOGGLE_BOOKMARK, { lessonId }), { method: "POST" });
  },
};

export const PaymentController = {
  createCheckout(courseId: string, months: number) {
    const origin = window.location.origin;
    return api(withParams(ENDPOINTS.PURCHASE_CHECKOUT, { courseId }), {
      method: "POST",
      body: JSON.stringify({
        months,
        successUrl: `${origin}/payment/success?courseId=${courseId}`,
        cancelUrl: `${origin}/purchase-course/${courseId}`,
      }),
    });
  },
  createPaymentIntent(courseId: string, months: number) {
    return api(withParams(ENDPOINTS.PURCHASE_PAYMENT_INTENT, { courseId }), {
      method: "POST",
      body: JSON.stringify({ months }),
    });
  },
  confirmPayment(courseId: string, paymentIntentId: string) {
    return api(withParams(ENDPOINTS.PURCHASE_CONFIRM, { courseId }), {
      method: "POST",
      body: JSON.stringify({ paymentIntentId }),
    });
  },
  getMyPurchases() {
    return api(ENDPOINTS.MY_PURCHASES, { method: "GET" });
  },
  getMySubscription() {
    return api(ENDPOINTS.MY_SUBSCRIPTION, { method: "GET" });
  },
  getPlans() {
    return api(ENDPOINTS.PLANS, { method: "GET" });
  },
  cancelSubscription() {
    return api(ENDPOINTS.CANCEL_SUBSCRIPTION, { method: "POST" });
  },
};

export const GalleryController = {
  getGallery(params?: { category?: string; search?: string; page?: number }) {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.search) q.set("search", params.search);
    if (params?.page) q.set("page", String(params.page));
    q.set("limit", "12");
    const qs = q.toString();
    return api(`${ENDPOINTS.GALLERY}${qs ? `?${qs}` : ""}`, { method: "GET" });
  },
};

export const NotificationController = {
  getNotifications(page = 1) {
    return api(`${ENDPOINTS.NOTIFICATIONS}?page=${page}`, { method: "GET" });
  },
  markAllRead() {
    return api(ENDPOINTS.NOTIFICATIONS_READ_ALL, { method: "POST" });
  },
  markRead(id: string) {
    return api(withParams(ENDPOINTS.NOTIFICATION_READ, { id }), { method: "POST" });
  },
};

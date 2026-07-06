export const ENDPOINTS = {
  // Auth
  LOGIN: "/auth/login",
  LOGIN_OTP_SEND: "/auth/login-otp/send",
  LOGIN_OTP_VERIFY: "/auth/login-otp/verify",
  REGISTER: "/auth/register",
  VERIFY_OTP: "/auth/verify-otp",
  RESEND_OTP: "/auth/resend-otp",
  REGISTRATION_STATUS: "/auth/registration-status",
  FORGOT_PASSWORD: "/auth/forgot-password",
  RESET_PASSWORD: "/auth/reset-password",
  LOGOUT: "/auth/logout",
  GET_PROFILE: "/auth/me",
  UPDATE_PROFILE: "/auth/me",
  DELETE_ACCOUNT: "/auth/deleteAccount",

  // Courses
  GET_COURSES: "/courses",
  GET_COURSE: "/courses/:id",
  GET_COURSE_CONTENT: "/courses/:id/content",
  GET_MY_LEARNING: "/courses/my-learning",
  GET_MODULES: "/courses/:id/modules",
  GET_MODULE_LESSONS: "/modules/:moduleId/with-lessons",
  GET_LESSON: "/lessons/:id",
  GET_LESSON_STREAM: "/lessons/:lessonId/stream",
  GET_LESSON_FREE_STREAM: "/lessons/:lessonId/free-stream",
  WATCH_HISTORY: "/watch-history",
  BOOKMARKS: "/bookmarks",
  TOGGLE_BOOKMARK: "/bookmarks/:lessonId",

  // Purchases & reviews
  PURCHASE_CHECKOUT: "/courses/:courseId/purchase/checkout",
  PURCHASE_PAYMENT_INTENT: "/courses/:courseId/purchase/payment-intent",
  PURCHASE_CONFIRM: "/courses/:courseId/purchase/confirm",
  MY_PURCHASES: "/course-purchases/my",
  COURSE_REVIEWS: "/courses/:courseId/reviews",
  MY_REVIEW: "/courses/:courseId/my-review",
  SUBMIT_REVIEW: "/courses/:courseId/review",

  // Subscriptions
  PLANS: "/plans",
  SUBSCRIBE: "/subscriptions",
  CANCEL_SUBSCRIPTION: "/subscriptions/cancel",
  MY_SUBSCRIPTION: "/subscriptions/my",

  // Notifications
  NOTIFICATIONS: "/notifications",
  NOTIFICATIONS_READ_ALL: "/notifications/read-all",
  NOTIFICATION_READ: "/notifications/:id/read",

  CONFIG_STRIPE: "/config/stripe",

  // Gallery
  GALLERY: "/gallery",
};

export function withParams(path: string, params: Record<string, string>) {
  return Object.entries(params).reduce(
    (p, [key, value]) => p.replace(`:${key}`, value),
    path
  );
}

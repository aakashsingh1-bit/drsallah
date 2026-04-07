const express = require('express');
const router = express.Router();
const {
  getAllUsers, getUserById, updateUser, suspendUser, unsuspendUser,
  deleteUser, forceLogoutUser, getSecurityLogs, resolveSecurityLog,
  getFlaggedUsers, getDashboardStats, getUserGrowth, getVideoAnalytics,
  sendBulkNotification,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

/**
 * @openapi
 * tags:
 *   name: Admin
 *   description: Admin panel - requires admin JWT token
 */

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Get dashboard overview stats
 *     responses:
 *       200:
 *         description: Users, subscriptions, revenue, security alerts counts
 */
router.get('/dashboard', getDashboardStats);

/**
 * @openapi
 * /admin/analytics/users:
 *   get:
 *     tags: [Admin]
 *     summary: User growth by month
 *     responses:
 *       200:
 *         description: Monthly user growth data
 */
router.get('/analytics/users', getUserGrowth);

/**
 * @openapi
 * /admin/analytics/videos:
 *   get:
 *     tags: [Admin]
 *     summary: Video playback analytics and top lessons
 *     responses:
 *       200:
 *         description: Top lessons and daily playback counts
 */
router.get('/analytics/videos', getVideoAnalytics);

// ─── User Management ───────────────────────────────────────────────────────────
/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users with filters
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: isSuspended
 *         schema: { type: boolean }
 *       - in: query
 *         name: isFlagged
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated users list
 */
router.get('/users', getAllUsers);

/**
 * @openapi
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user profile with recent security logs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details
 *   put:
 *     tags: [Admin]
 *     summary: Update user info
 *     responses:
 *       200:
 *         description: Updated user
 *   delete:
 *     tags: [Admin]
 *     summary: Delete user
 *     responses:
 *       200:
 *         description: User deleted
 */
router.route('/users/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

/**
 * @openapi
 * /admin/users/{id}/suspend:
 *   post:
 *     tags: [Admin]
 *     summary: Suspend a user account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: User suspended
 */
router.post('/users/:id/suspend', suspendUser);

/**
 * @openapi
 * /admin/users/{id}/unsuspend:
 *   post:
 *     tags: [Admin]
 *     summary: Unsuspend a user account and reset risk score
 *     responses:
 *       200:
 *         description: User unsuspended
 */
router.post('/users/:id/unsuspend', unsuspendUser);

/**
 * @openapi
 * /admin/users/{id}/force-logout:
 *   post:
 *     tags: [Admin]
 *     summary: Force logout - revoke all sessions for a user
 *     responses:
 *       200:
 *         description: All sessions revoked
 */
router.post('/users/:id/force-logout', forceLogoutUser);

// ─── Security Monitoring ───────────────────────────────────────────────────────
/**
 * @openapi
 * /admin/security/logs:
 *   get:
 *     tags: [Admin]
 *     summary: Get security logs with filters
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: event
 *         schema: { type: string }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [info, warning, critical] }
 *       - in: query
 *         name: resolved
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Security logs
 */
router.get('/security/logs', getSecurityLogs);

/**
 * @openapi
 * /admin/security/logs/{id}/resolve:
 *   post:
 *     tags: [Admin]
 *     summary: Mark a security log as resolved
 *     responses:
 *       200:
 *         description: Log resolved
 */
router.post('/security/logs/:id/resolve', resolveSecurityLog);

/**
 * @openapi
 * /admin/security/flagged-users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all flagged users sorted by risk score
 *     responses:
 *       200:
 *         description: Flagged users list
 */
router.get('/security/flagged-users', getFlaggedUsers);

// ─── Notifications ─────────────────────────────────────────────────────────────
/**
 * @openapi
 * /admin/notifications/broadcast:
 *   post:
 *     tags: [Admin]
 *     summary: Send push notification to all or specific users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body, type]
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               type:
 *                 type: string
 *                 enum: [new_content, subscription_expiry, security_alert, general]
 *               userIds:
 *                 type: array
 *                 items: { type: string }
 *                 description: If empty, sends to all students
 *     responses:
 *       200:
 *         description: Notifications sent
 */
router.post('/notifications/broadcast', sendBulkNotification);

module.exports = router;
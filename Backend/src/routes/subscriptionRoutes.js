const express = require('express');
const router = express.Router();
const {
  getAllPlans, createPlan, updatePlan, deletePlan,
  subscribe, getMySubscription, cancelSubscription,
  getAllSubscriptions, getRevenueAnalytics,
} = require('../controllers/subscriptionController');
const { protect, adminOnly } = require('../middleware/auth');

/**
 * @openapi
 * tags:
 *   name: Subscriptions
 *   description: Plans and user subscriptions
 */

/**
 * @openapi
 * /plans:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get all active subscription plans
 *     security: []
 *     responses:
 *       200:
 *         description: List of plans
 *   post:
 *     tags: [Subscriptions]
 *     summary: Admin - Create a new plan
 *     responses:
 *       201:
 *         description: Plan created
 */
router.route('/plans')
  .get(getAllPlans)
  .post(protect, adminOnly, createPlan);

/**
 * @openapi
 * /plans/{id}:
 *   put:
 *     tags: [Subscriptions]
 *     summary: Admin - Update a plan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan updated
 *   delete:
 *     tags: [Subscriptions]
 *     summary: Admin - Deactivate a plan
 *     responses:
 *       200:
 *         description: Plan deactivated
 */
router.route('/plans/:id')
  .put(protect, adminOnly, updatePlan)
  .delete(protect, adminOnly, deletePlan);

/**
 * @openapi
 * /subscriptions/my:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get current user's active subscription
 *     responses:
 *       200:
 *         description: Active subscription or null
 */
router.get('/subscriptions/my', protect, getMySubscription);

/**
 * @openapi
 * /subscriptions:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Subscribe to a plan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, paymentMethod]
 *             properties:
 *               planId: { type: string }
 *               paymentMethod:
 *                 type: string
 *                 enum: [apple_iap, google_play, manual, card]
 *               transactionId: { type: string }
 *               amountPaid: { type: number }
 *     responses:
 *       201:
 *         description: Subscription created
 */
router.post('/subscriptions', protect, subscribe);

/**
 * @openapi
 * /subscriptions/cancel:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Cancel current subscription
 *     responses:
 *       200:
 *         description: Subscription cancelled
 */
router.post('/subscriptions/cancel', protect, cancelSubscription);

// Admin routes
/**
 * @openapi
 * /admin/subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Admin - Get all subscriptions
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, expired, cancelled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: All subscriptions
 */
router.get('/admin/subscriptions', protect, adminOnly, getAllSubscriptions);

/**
 * @openapi
 * /admin/revenue:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Admin - Revenue analytics
 *     responses:
 *       200:
 *         description: Monthly revenue and per-plan breakdown
 */
router.get('/admin/revenue', protect, adminOnly, getRevenueAnalytics);

module.exports = router;
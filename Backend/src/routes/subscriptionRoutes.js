const express = require('express');
const router = express.Router();
const {
  getAllPlans, createPlan, updatePlan, deletePlan,
  subscribe, getMySubscription, cancelSubscription,
  getAllSubscriptions, getRevenueAnalytics,
} = require('../controllers/subscriptionController');
const {
  createCourseCheckoutSession,
  createCoursePaymentIntent,
  confirmCoursePayment,
  getMyCoursePurchases,
  getAllCoursePurchases,
  createCourseReview,
  getCourseReviews,
  getMyCourseReview,
  getAllCourseReviewsAdmin,
  approveCourseReview,
  deleteCourseReview,
} = require('../controllers/paymentController');
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

/**
 * @openapi
 * tags:
 *   - name: Course Purchases
 *     description: Per-course purchase & checkout (Stripe)
 *   - name: Course Reviews
 *     description: Student reviews for course completion
 */

/**
 * @openapi
 * /courses/{courseId}/purchase/checkout:
 *   post:
 *     tags: [Course Purchases]
 *     summary: Create Stripe Checkout Session for course purchase
 *     description: Creates a Stripe Checkout Session for web-based payment. Returns a URL to redirect the user to Stripe's hosted checkout page.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [months]
 *             properties:
 *               months:
 *                 type: integer
 *                 description: Duration tier (e.g. 1, 3, 6, 12)
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Checkout session created
 *       400:
 *         description: Invalid tier or already has active access
 *       404:
 *         description: Course not found
 *
 * /courses/{courseId}/purchase/payment-intent:
 *   post:
 *     tags: [Course Purchases]
 *     summary: Create Stripe PaymentIntent for mobile app purchase
 *     description: Creates a Stripe PaymentIntent for mobile app usage. Returns client_secret for Stripe mobile SDKs to complete payment without web redirect.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [months]
 *             properties:
 *               months:
 *                 type: integer
 *     responses:
 *       201:
 *         description: PaymentIntent created with client_secret
 *       400:
 *         description: Invalid tier or already has active access
 *       404:
 *         description: Course not found
 *
 * /course-purchases/my:
 *   get:
 *     tags: [Course Purchases]
 *     summary: Get current user's course purchase history
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's purchases
 *
 * /admin/course-purchases:
 *   get:
 *     tags: [Course Purchases]
 *     summary: Admin - Get all course purchases
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, active, expired, failed] }
 *       - in: query
 *         name: courseId
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list of purchases
 */
router.post('/courses/:courseId/purchase/checkout', protect, createCourseCheckoutSession);
router.post('/courses/:courseId/purchase/payment-intent', protect, createCoursePaymentIntent);
router.post('/courses/:courseId/purchase/confirm', protect, confirmCoursePayment);
router.get('/course-purchases/my', protect, getMyCoursePurchases);
router.get('/admin/course-purchases', protect, adminOnly, getAllCoursePurchases);

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

// ════════════════════════════════════════════════════════════════
// COURSE REVIEWS
// ════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /courses/{courseId}/review:
 *   post:
 *     tags: [Course Reviews]
 *     summary: Student - Submit a review for a course (unlocks final lesson)
 *     description: Requires active course purchase. Only one review per user per course.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, min: 1, max: 5 }
 *               comment: { type: string, maxlength: 2000 }
 *     responses:
 *       201:
 *         description: Review created
 *   get:
 *     tags: [Course Reviews]
 *     summary: Get approved reviews for a course
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of reviews
 *
 * /courses/{courseId}/my-review:
 *   get:
 *     tags: [Course Reviews]
 *     summary: Get current user's review for a course
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User's review or null
 *
 * /admin/course-reviews:
 *   get:
 *     tags: [Course Reviews]
 *     summary: Admin - Get all course reviews (paginated)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list of all reviews
 * /admin/course-reviews/{reviewId}/approve:
 *   post:
 *     tags: [Course Reviews]
 *     summary: Admin - Approve a pending review
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review approved
 * /admin/course-reviews/{reviewId}:
 *   delete:
 *     tags: [Course Reviews]
 *     summary: Admin - Delete a review
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review deleted
 */
// Student review routes
router.post('/courses/:courseId/review', protect, createCourseReview);
router.get('/courses/:courseId/reviews', protect, getCourseReviews);
router.get('/courses/:courseId/my-review', protect, getMyCourseReview);

// Admin review routes
router.get('/admin/course-reviews', protect, adminOnly, getAllCourseReviewsAdmin);
router.post('/admin/course-reviews/:reviewId/approve', protect, adminOnly, approveCourseReview);
router.delete('/admin/course-reviews/:reviewId', protect, adminOnly, deleteCourseReview);

module.exports = router;

const stripeLib = require('stripe');
const { Course } = require('../models/Content');
const { CoursePurchase, CourseReview } = require('../models/CourseAccess');
const Notification = require('../models/Notification');
const SecurityLog = require('../models/SecurityLog');
const s3Service = require('../services/s3Service');

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return stripeLib(process.env.STRIPE_SECRET_KEY);
};

const EXPIRY = () => parseInt(process.env.SIGNED_URL_EXPIRY, 10) || 3600;

const safeSignedUrl = async (key) => {
  if (!key) return null;
  try {
    const { streamUrl } = await s3Service.getPresignedStreamUrl(key, EXPIRY());
    return streamUrl;
  } catch {
    return null;
  }
};

const addMonths = (date, months) => {
  const end = new Date(date);
  end.setMonth(end.getMonth() + Number(months));
  return end;
};

const findPriceTier = (course, months) => {
  const selectedMonths = Number(months);
  return course.priceTiers?.find((tier) =>
    tier.isActive !== false &&
    Number(tier.months) === selectedMonths &&
    Number(tier.price) >= 0
  );
};

const activatePurchaseFromSession = async (session) => {
  const purchase = await CoursePurchase.findOne({ stripeCheckoutSessionId: session.id });
  if (!purchase || purchase.status === 'active') return purchase;

  const startDate = new Date();
  purchase.status = 'active';
  purchase.startDate = startDate;
  purchase.endDate = addMonths(startDate, purchase.months);
  purchase.stripePaymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
  await purchase.save();

  await Promise.all([
    Course.findByIdAndUpdate(purchase.course, { $inc: { totalEnrolled: 1 } }),
    Notification.create({
      user: purchase.user,
      title: 'Course Access Active',
      body: 'Your course purchase is active. Enjoy learning!',
      type: 'general',
    }),
    SecurityLog.create({
      user: purchase.user,
      event: 'course_purchase_activated',
      details: {
        courseId: purchase.course,
        purchaseId: purchase._id,
        endDate: purchase.endDate,
      },
    }),
  ]);

  return purchase;
};

exports.createCourseCheckoutSession = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(500).json({ success: false, message: 'Stripe is not configured' });
  }

  const { months, successUrl, cancelUrl } = req.body;
  const course = await Course.findById(req.params.courseId);
  if (!course || !course.isPublished) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  const tier = findPriceTier(course, months);
  if (!tier) {
    return res.status(400).json({ success: false, message: 'Invalid or inactive course price tier' });
  }

  const existing = await CoursePurchase.findOne({
    user: req.user._id,
    course: course._id,
    status: 'active',
    endDate: { $gte: new Date() },
  });
  if (existing) {
    return res.status(400).json({ success: false, message: 'You already have active access to this course' });
  }

  const fallbackSuccess = `${process.env.CLIENT_URL || process.env.ADMIN_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
  const fallbackCancel = `${process.env.CLIENT_URL || process.env.ADMIN_URL || 'http://localhost:3000'}/payment/cancel`;
  const currency = (tier.currency || 'AED').toLowerCase();
  const amount = Math.round(Number(tier.price) * 100);

  const purchase = await CoursePurchase.create({
    user: req.user._id,
    course: course._id,
    months: Number(tier.months),
    status: 'pending',
    amountPaid: Number(tier.price),
    currency: tier.currency || 'AED',
    paymentProvider: 'stripe',
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: req.user.email,
    success_url: successUrl || fallbackSuccess,
    cancel_url: cancelUrl || fallbackCancel,
    metadata: {
      purchaseId: purchase._id.toString(),
      userId: req.user._id.toString(),
      courseId: course._id.toString(),
      months: String(tier.months),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: `${course.title} - ${tier.months} month access`,
            description: course.description?.slice(0, 500) || undefined,
          },
        },
      },
    ],
  });

  purchase.stripeCheckoutSessionId = session.id;
  purchase.metadata = { checkoutUrl: session.url };
  await purchase.save();

  res.status(201).json({
    success: true,
    data: {
      checkoutUrl: session.url,
      sessionId: session.id,
      purchaseId: purchase._id,
    },
  });
};

// ════════════════════════════════════════════════════════════════
// STRIPE PAYMENT INTENT (for mobile apps)
// ════════════════════════════════════════════════════════════════

exports.createCoursePaymentIntent = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(500).json({ success: false, message: 'Stripe is not configured' });
  }

  const { months } = req.body;
  const course = await Course.findById(req.params.courseId);
  if (!course || !course.isPublished) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  const tier = findPriceTier(course, months);
  if (!tier) {
    return res.status(400).json({ success: false, message: 'Invalid or inactive course price tier' });
  }

  // Check existing active purchase
  const existing = await CoursePurchase.findOne({
    user: req.user._id,
    course: course._id,
    status: 'active',
    endDate: { $gte: new Date() },
  });
  if (existing) {
    return res.status(400).json({ success: false, message: 'You already have active access to this course' });
  }

  const currency = (tier.currency || 'AED').toLowerCase();
  const amount = Math.round(Number(tier.price) * 100);

  // Create purchase record with pending status
  const purchase = await CoursePurchase.create({
    user: req.user._id,
    course: course._id,
    months: Number(tier.months),
    status: 'pending',
    amountPaid: Number(tier.price),
    currency: tier.currency || 'AED',
    paymentProvider: 'stripe',
  });

  // Create Stripe PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    receipt_email: req.user.email,
    metadata: {
      purchaseId: purchase._id.toString(),
      userId: req.user._id.toString(),
      courseId: course._id.toString(),
      months: String(tier.months),
      source: 'mobile_app',
    },
    description: `${course.title} - ${tier.months} month access`,
  });

  purchase.stripePaymentIntentId = paymentIntent.id;
  await purchase.save();

  res.status(201).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      purchaseId: purchase._id,
      amount,
      currency,
    },
  });
};

/**
 * POST /courses/:courseId/purchase/confirm
 * Mobile app calls this AFTER the PaymentIntent succeeds on the client side.
 * This confirms the payment and activates the purchase directly,
 * without relying on the Stripe webhook.
 */
exports.confirmCoursePayment = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(500).json({ success: false, message: 'Stripe is not configured' });
  }

  const { paymentIntentId } = req.body;
  if (!paymentIntentId) {
    return res.status(400).json({ success: false, message: 'paymentIntentId is required' });
  }

  // Find the pending purchase — or already-active (webhook race)
  let purchase = await CoursePurchase.findOne({
    stripePaymentIntentId: paymentIntentId,
    user: req.user._id,
    status: 'pending',
  });

  if (!purchase) {
    const alreadyActive = await CoursePurchase.findOne({
      stripePaymentIntentId: paymentIntentId,
      user: req.user._id,
      status: 'active',
    });
    if (alreadyActive) {
      return res.json({
        success: true,
        data: {
          purchaseId: alreadyActive._id,
          endDate: alreadyActive.endDate,
          alreadyActive: true,
        },
      });
    }
    return res.status(404).json({ success: false, message: 'Purchase not found or already activated' });
  }

  // Verify the PaymentIntent status with Stripe
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: `Payment has not succeeded yet. Current status: ${paymentIntent.status}`,
      });
    }

    // Activate the purchase
    const startDate = new Date();
    purchase.status = 'active';
    purchase.startDate = startDate;
    purchase.endDate = addMonths(startDate, purchase.months);
    await purchase.save();

    await Promise.all([
      Course.findByIdAndUpdate(purchase.course, { $inc: { totalEnrolled: 1 } }),
      Notification.create({
        user: purchase.user,
        title: 'Course Access Active',
        body: 'Your course purchase is active. Enjoy learning!',
        type: 'general',
      }),
      SecurityLog.create({
        user: purchase.user,
        event: 'course_purchase_activated',
        details: {
          courseId: purchase.course,
          purchaseId: purchase._id,
          endDate: purchase.endDate,
          source: 'payment_intent_confirm',
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        purchaseId: purchase._id,
        endDate: purchase.endDate,
      },
    });
  } catch (err) {
    console.error('[confirmCoursePayment] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const activatePurchaseFromPaymentIntent = async (paymentIntent) => {
  const purchase = await CoursePurchase.findOne({ stripePaymentIntentId: paymentIntent.id });
  if (!purchase || purchase.status === 'active') return purchase;

  const startDate = new Date();
  purchase.status = 'active';
  purchase.startDate = startDate;
  purchase.endDate = addMonths(startDate, purchase.months);
  purchase.stripePaymentIntentId = paymentIntent.id;
  await purchase.save();

  await Promise.all([
    Course.findByIdAndUpdate(purchase.course, { $inc: { totalEnrolled: 1 } }),
    Notification.create({
      user: purchase.user,
      title: 'Course Access Active',
      body: 'Your course purchase is active. Enjoy learning!',
      type: 'general',
    }),
    SecurityLog.create({
      user: purchase.user,
      event: 'course_purchase_activated',
      details: {
        courseId: purchase.course,
        purchaseId: purchase._id,
        endDate: purchase.endDate,
        source: 'payment_intent',
      },
    }),
  ]);

  return purchase;
};

exports.handleStripeWebhook = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).json({ success: false, message: 'Stripe is not configured' });

  let event;
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header (bot/probe or wrong URL)');
      return res.status(400).send('Webhook Error: Missing stripe-signature header');
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not set');
      return res.status(500).send('Webhook Error: Server misconfigured');
    }
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`[Webhook] Received event: ${event.type}, ID: ${event.id}`);
  } catch (err) {
    // Stripe retries failed deliveries for days — fix secret/endpoint once and retries stop.
    console.error(`[Webhook] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      console.log(`[Webhook] Processing checkout.session.completed: ${event.data.object.id}`);
      await activatePurchaseFromSession(event.data.object);
    }

    if (event.type === 'checkout.session.expired') {
      console.log(`[Webhook] Processing checkout.session.expired: ${event.data.object.id}`);
      await CoursePurchase.findOneAndUpdate(
        { stripeCheckoutSessionId: event.data.object.id, status: 'pending' },
        { status: 'failed' }
      );
    }

    // Handle PaymentIntent for mobile app payments
    if (event.type === 'payment_intent.succeeded') {
      console.log(`[Webhook] Processing payment_intent.succeeded: ${event.data.object.id}, metadata:`, JSON.stringify(event.data.object.metadata));
      await activatePurchaseFromPaymentIntent(event.data.object);
    }

    if (event.type === 'payment_intent.payment_failed') {
      console.log(`[Webhook] Processing payment_intent.payment_failed: ${event.data.object.id}`);
      await CoursePurchase.findOneAndUpdate(
        { stripePaymentIntentId: event.data.object.id, status: 'pending' },
        { status: 'failed' }
      );
    }
  } catch (err) {
    console.error(`[Webhook] Error processing event ${event.type}:`, err.message, err.stack);
    // Still return 200 to Stripe so it doesn't retry endlessly, but log the error
  }

  res.json({ received: true });
};

exports.getMyCoursePurchases = async (req, res) => {
  await CoursePurchase.updateMany(
    { user: req.user._id, status: 'active', endDate: { $lt: new Date() } },
    { status: 'expired' }
  );

  const purchases = await CoursePurchase.find({ user: req.user._id })
    .populate('course', 'title thumbnail thumbnailKey category')
    .sort({ createdAt: -1 });

  const data = await Promise.all(
    purchases.map(async (purchase) => {
      const obj = purchase.toObject();
      if (obj.course?.thumbnailKey) {
        obj.course.thumbnail =
          (await safeSignedUrl(obj.course.thumbnailKey)) || obj.course.thumbnail || null;
        delete obj.course.thumbnailKey;
      }
      return obj;
    })
  );

  res.json({ success: true, data });
};

// ════════════════════════════════════════════════════════════════
// COURSE REVIEWS
// ════════════════════════════════════════════════════════════════

exports.createCourseReview = async (req, res) => {
  const { rating, comment } = req.body;
  const courseId = req.params.courseId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  // Check user has active purchase
  const purchase = await CoursePurchase.findOne({
    user: req.user._id,
    course: courseId,
    status: 'active',
    endDate: { $gte: new Date() },
  });
  if (!purchase) {
    return res.status(403).json({ success: false, message: 'You must have active access to this course to leave a review' });
  }

  // Check if already reviewed
  const existing = await CourseReview.findOne({ user: req.user._id, course: courseId });
  if (existing) {
    return res.status(400).json({ success: false, message: 'You have already reviewed this course' });
  }

  const review = await CourseReview.create({
    user: req.user._id,
    course: courseId,
    rating: Number(rating),
    comment: comment?.trim() || '',
  });

  res.status(201).json({ success: true, data: review });
};

exports.getCourseReviews = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const courseId = req.params.courseId;

  const [reviews, total] = await Promise.all([
    CourseReview.find({ course: courseId, isApproved: true })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit)),
    CourseReview.countDocuments({ course: courseId, isApproved: true }),
  ]);

  res.json({ success: true, data: reviews, pagination: { total, page: +page, limit: +limit } });
};

exports.getMyCourseReview = async (req, res) => {
  const review = await CourseReview.findOne({
    user: req.user._id,
    course: req.params.courseId,
  });
  res.json({ success: true, data: review });
};

exports.getAllCourseReviewsAdmin = async (req, res) => {
  const { page = 1, limit = 20, courseId } = req.query;
  const filter = {};
  if (courseId) filter.course = courseId;

  const [reviews, total] = await Promise.all([
    CourseReview.find(filter)
      .populate('user', 'name email')
      .populate('course', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit)),
    CourseReview.countDocuments(filter),
  ]);

  res.json({ success: true, data: reviews, pagination: { total, page: +page, limit: +limit } });
};

exports.approveCourseReview = async (req, res) => {
  const review = await CourseReview.findByIdAndUpdate(
    req.params.reviewId,
    { isApproved: true },
    { new: true }
  );
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  res.json({ success: true, data: review });
};

exports.deleteCourseReview = async (req, res) => {
  const review = await CourseReview.findByIdAndDelete(req.params.reviewId);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  res.json({ success: true, message: 'Review deleted' });
};

exports.getAllCoursePurchases = async (req, res) => {
  const { page = 1, limit = 20, status, courseId, userId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (courseId) filter.course = courseId;
  if (userId) filter.user = userId;

  const [purchases, total] = await Promise.all([
    CoursePurchase.find(filter)
      .populate('user', 'name email phone')
      .populate('course', 'title category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit)),
    CoursePurchase.countDocuments(filter),
  ]);

  res.json({ success: true, data: purchases, pagination: { total, page: +page, limit: +limit } });
};

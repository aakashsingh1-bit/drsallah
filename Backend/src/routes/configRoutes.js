const express = require('express');
const router = express.Router();

/**
 * GET /config/stripe
 * Public — returns Stripe publishable key for client-side Payment Element.
 */
router.get('/config/stripe', (req, res) => {
  const publishableKey =
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ||
    '';

  res.json({
    success: true,
    data: {
      publishableKey,
      configured: Boolean(publishableKey && publishableKey.startsWith('pk_')),
    },
  });
});

module.exports = router;

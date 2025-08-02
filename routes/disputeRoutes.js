const express = require('express');
const { analyzeTransaction, healthCheck } = require('../controllers/disputeController');
const { createRateLimiter } = require('../middleware/validation');

const router = express.Router();

// Create rate limiter instance
const rateLimiter = createRateLimiter();

// Health check endpoint
router.get('/health', healthCheck);

// Main transaction analysis endpoint
router.post('/analyze', rateLimiter, analyzeTransaction);

// Catch-all for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /analyze'
    ]
  });
});

module.exports = router; 
const express = require('express');
const logger = require('../config/logger');
const { connectMongoDB, connectRedis } = require('../config/database');
const disputeRoutes = require('../routes/disputeRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/v1', disputeRoutes);

// Global error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Export as Vercel handler
module.exports = async (req, res) => {
  // Ensure DB connections (no-op if already connected)
  await Promise.all([
    
    connectMongoDB(),
    connectRedis()
  ]);
  app(req, res);
};

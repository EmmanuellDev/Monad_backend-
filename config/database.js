const mongoose = require('mongoose');
const Redis = require('redis');
const logger = require('./logger');

// MongoDB Configuration
const connectMongoDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('MongoDB connected successfully');
    } else {
      logger.warn('MongoDB URI not provided, skipping MongoDB connection');
    }
  } catch (error) {
    logger.error('MongoDB connection error:', error);
  }
};

// Redis Configuration
let redisClient = null;

const connectRedis = async () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = Redis.createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD || undefined
      });

      redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      await redisClient.connect();
    } else {
      logger.warn('Redis URL not provided, caching will be disabled');
    }
  } catch (error) {
    logger.error('Redis connection error:', error);
  }
};

const getRedisClient = () => redisClient;

module.exports = {
  connectMongoDB,
  connectRedis,
  getRedisClient
}; 
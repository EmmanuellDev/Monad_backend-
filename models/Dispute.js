const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  txHash: {
    type: String,
    required: true,
    index: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  toAddress: {
    type: String,
    required: true
  },
  disputeDescription: {
    type: String,
    required: true
  },
  aiSolution: {
    type: String,
    required: true
  },
  parsedLogs: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  contractState: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  transactionStatus: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
disputeSchema.index({ txHash: 1, createdAt: -1 });

module.exports = mongoose.model('Dispute', disputeSchema); 
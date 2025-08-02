const blockchainService = require('../utils/blockchain');
const aiService = require('../services/aiService');
const logger = require('../config/logger');

/**
 * Analyze any blockchain transaction
 */
const analyzeTransaction = async (req, res) => {
  try {

    const { txHash, contractAddress: inputContractAddress, disputeDescription } = req.body;

    // Validate input: only txHash is required
    if (!txHash) {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash is required'
      });
    }

    let contractAddress = inputContractAddress;

    // If contractAddress is not provided, try to fetch it from the transaction
    if (!contractAddress) {
      try {
        const transaction = await blockchainService.provider.getTransaction(txHash);
        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: 'Transaction not found'
          });
        }
        // Use the 'to' field as contract address if it looks like a contract (not a normal wallet)
        contractAddress = transaction.to;
        // Optionally, you could add logic to check if 'to' is a contract address
      } catch (err) {
        logger.error('Error fetching transaction for contract address:', err.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch contract address from transaction'
        });
      }
    }


    // Proceed even if contractAddress is not found; pass null/undefined to analysis

    logger.info(`Analyzing transaction: ${txHash} for contract: ${contractAddress}`);

    // Get comprehensive transaction analysis
    const analysis = await blockchainService.analyzeTransaction(txHash, contractAddress);

    // If dispute description is provided, get AI analysis
    let aiAnalysis = null;
    if (disputeDescription) {
      aiAnalysis = await aiService.analyzeDispute(
        txHash,
        contractAddress,
        disputeDescription,
        analysis.events,
        analysis.transaction
      );
    }

    // Return comprehensive response
    res.json({
      success: true,
      data: {
        txHash,
        contractAddress,
        disputeDescription: disputeDescription || null,
        aiAnalysis,
        transaction: analysis.transaction,
        events: analysis.events,
        contractState: analysis.contractState,
        analysis: analysis.analysis
      }
    });

  } catch (error) {
    logger.error('Transaction analysis error:', error.message);
    
    if (error.message.includes('Transaction not found')) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    if (error.message.includes('AI service')) {
      return res.status(503).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Health check endpoint
 */
const healthCheck = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Service unhealthy'
    });
  }
};

module.exports = {
  analyzeTransaction,
  healthCheck
}; 
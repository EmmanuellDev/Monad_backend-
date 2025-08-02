const axios = require('axios');
const logger = require('../config/logger');

class AIService {
  constructor() {
    this.apiUrl = process.env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    this.apiKey = process.env.AI_API_KEY;
  }

  /**
   * Analyze transaction dispute and determine refund eligibility
   */
  async analyzeDispute(txHash, contractAddress, disputeDescription, logs, transactionDetails) {
    try {
      if (!this.apiKey) {
        throw new Error('AI API key not configured');
      }

      const prompt = this.buildDisputePrompt(txHash, contractAddress, disputeDescription, logs, transactionDetails);
      
      const response = await axios.post(this.apiUrl, {
        model: 'llama3-70b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are an AI expert analyzing blockchain transaction disputes on Monad Testnet. Your job is to determine if a refund is warranted based on the transaction logs and user complaint.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        const aiResponse = response.data.choices[0].message.content;
        logger.info('AI dispute analysis completed successfully');
        return aiResponse;
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (error) {
      logger.error('AI service error:', error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  /**
   * Build prompt for dispute analysis
   */
  buildDisputePrompt(txHash, contractAddress, disputeDescription, logs, transactionDetails) {
    return `Analyze this blockchain transaction dispute:

Transaction Hash: ${txHash}
Contract Address: ${contractAddress}

User Dispute: ${disputeDescription}

Transaction Details:
${JSON.stringify(transactionDetails, null, 2)}

Contract Logs:
${JSON.stringify(logs, null, 2)}

Based on the transaction logs and the user's complaint, determine:

1. What actually happened in the transaction
2. Whether the user's complaint is valid
3. The appropriate resolution:

   - **REFUND**: If the transaction failed or didn't complete as expected
   - **NO REFUND**: If the transaction was successful and the user's claim is incorrect
   - **NOT POSSIBLE**: If the transaction type doesn't support refunds or other technical reasons

Provide a clear analysis explaining:
- What the transaction did
- Whether the user's complaint is justified
- Your refund recommendation (REFUND/NO REFUND/NOT POSSIBLE)
- Reasoning for your decision

Be concise but thorough in your analysis.`;
  }

  /**
   * Send transaction data to Groq AI for analysis (legacy method)
   */
  async analyzeTransaction(txHash, contractAddress, logs, transactionDetails) {
    try {
      if (!this.apiKey) {
        throw new Error('AI API key not configured');
      }

      const prompt = this.buildPrompt(txHash, contractAddress, logs, transactionDetails);
      
      const response = await axios.post(this.apiUrl, {
        model: 'llama3-70b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are an AI analyzing blockchain transactions on Monad Testnet. Analyze the transaction logs and details to provide insights about what happened.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        const aiResponse = response.data.choices[0].message.content;
        logger.info('AI analysis completed successfully');
        return aiResponse;
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (error) {
      logger.error('AI service error:', error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  /**
   * Build prompt for AI analysis (legacy method)
   */
  buildPrompt(txHash, contractAddress, logs, transactionDetails) {
    return `Analyze this blockchain transaction:

Transaction Hash: ${txHash}
Contract Address: ${contractAddress}

Transaction Details:
${JSON.stringify(transactionDetails, null, 2)}

Contract Logs:
${JSON.stringify(logs, null, 2)}

Please provide a clear analysis of:
1. What type of transaction this is
2. What events occurred
3. Any transfers or state changes
4. Whether the transaction was successful
5. Any notable patterns or issues

Provide a concise, user-friendly explanation.`;
  }
}

module.exports = new AIService(); 
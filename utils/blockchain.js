const { ethers } = require('ethers');
const logger = require('../config/logger');
const { getRedisClient } = require('../config/database');

// Standard ERC-20 and ERC-721 ABIs for common events
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Deposit(address indexed from, uint256 value)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

const ERC721_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)'
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.redisClient = getRedisClient();
    this.initProvider();
  }

  /**
   * Initialize Ethereum provider with retry logic
   */
  async initProvider() {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const rpcUrl = process.env.MONAD_RPC_URL || process.env.ETHEREUM_RPC_URL;
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        await this.provider.getNetwork();
        logger.info(`Provider initialized successfully for ${rpcUrl.includes('monad') ? 'Monad Testnet' : 'Ethereum'}`);
        break;
      } catch (error) {
        retries++;
        logger.error(`Provider initialization attempt ${retries} failed:`, error.message);
        
        if (retries >= maxRetries) {
          throw new Error('Failed to initialize provider after 3 attempts');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }

  /**
   * Get comprehensive transaction analysis
   */
  async analyzeTransaction(txHash, contractAddress) {
    try {
      // Get transaction details
      const transaction = await this.provider.getTransaction(txHash);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Get block details for timestamp
      const block = await this.provider.getBlock(receipt.blockNumber);
      
      // Parse logs to find sender/receiver and events
      const parsedLogs = await this.parseLogs(receipt.logs, contractAddress);
      
      // Get contract state if possible
      const contractState = await this.getContractState(contractAddress, transaction.from);

      return {
        transaction: {
          hash: txHash,
          blockNumber: receipt.blockNumber,
          blockTime: block ? new Date(block.timestamp * 1000).toISOString() : null,
          from: transaction.from,
          to: transaction.to,
          value: transaction.value.toString(),
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status === 1 ? 'success' : 'failed',
          gasPrice: transaction.gasPrice.toString(),
          nonce: transaction.nonce
        },
        events: parsedLogs,
        contractState: contractState,
        analysis: this.analyzeTransactionPattern(transaction, receipt, parsedLogs)
      };

    } catch (error) {
      logger.error(`Failed to analyze transaction ${txHash}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse logs to extract sender/receiver addresses and events
   */
  async parseLogs(logs, contractAddress) {
    const parsedLogs = {
      transfers: [],
      deposits: [],
      otherEvents: [],
      contractType: 'Unknown',
      senderAddresses: new Set(),
      receiverAddresses: new Set()
    };

    try {
      for (const log of logs) {
        let parsed = false;
        
        // Try to parse as ERC-20 Transfer
        try {
          const erc20Interface = new ethers.Interface(ERC20_ABI);
          const parsedLog = erc20Interface.parseLog(log);
          
          if (parsedLog && parsedLog.name === 'Transfer') {
            const from = parsedLog.args[0];
            const to = parsedLog.args[1];
            const value = parsedLog.args[2].toString();
            
            parsedLogs.transfers.push({
              type: 'ERC20 Transfer',
              from: from,
              to: to,
              value: value,
              logIndex: log.logIndex,
              blockNumber: log.blockNumber
            });
            
            parsedLogs.senderAddresses.add(from);
            parsedLogs.receiverAddresses.add(to);
            parsedLogs.contractType = 'ERC20';
            parsed = true;
          } else if (parsedLog && parsedLog.name === 'Deposit') {
            const from = parsedLog.args[0];
            const value = parsedLog.args[1].toString();
            
            parsedLogs.deposits.push({
              type: 'Deposit',
              from: from,
              value: value,
              logIndex: log.logIndex,
              blockNumber: log.blockNumber
            });
            
            parsedLogs.senderAddresses.add(from);
            parsedLogs.contractType = 'ERC20';
            parsed = true;
          }
        } catch (error) {
          // Continue to next parsing attempt
        }

        // Try to parse as ERC-721 Transfer
        if (!parsed) {
          try {
            const erc721Interface = new ethers.Interface(ERC721_ABI);
            const parsedLog = erc721Interface.parseLog(log);
            
            if (parsedLog && parsedLog.name === 'Transfer') {
              const from = parsedLog.args[0];
              const to = parsedLog.args[1];
              const tokenId = parsedLog.args[2].toString();
              
              parsedLogs.transfers.push({
                type: 'ERC721 Transfer',
                from: from,
                to: to,
                tokenId: tokenId,
                logIndex: log.logIndex,
                blockNumber: log.blockNumber
              });
              
              parsedLogs.senderAddresses.add(from);
              parsedLogs.receiverAddresses.add(to);
              parsedLogs.contractType = 'ERC721';
              parsed = true;
            }
          } catch (error) {
            // Continue to next parsing attempt
          }
        }

        // If not parsed with known ABIs, extract raw event data
        if (!parsed) {
          const rawEvent = {
            type: 'Unknown Event',
            topics: log.topics,
            data: log.data,
            logIndex: log.logIndex,
            blockNumber: log.blockNumber,
            address: log.address
          };
          
          // Try to extract addresses from topics (common pattern)
          for (let i = 1; i < log.topics.length; i++) {
            const topic = log.topics[i];
            if (topic.length === 66) { // 32 bytes + 0x
              try {
                const address = ethers.getAddress('0x' + topic.slice(26));
                if (i === 1) {
                  parsedLogs.senderAddresses.add(address);
                } else if (i === 2) {
                  parsedLogs.receiverAddresses.add(address);
                }
              } catch (error) {
                // Not an address
              }
            }
          }
          
          parsedLogs.otherEvents.push(rawEvent);
        }
      }

      // Convert Sets to Arrays
      parsedLogs.senderAddresses = Array.from(parsedLogs.senderAddresses);
      parsedLogs.receiverAddresses = Array.from(parsedLogs.receiverAddresses);

      return parsedLogs;
    } catch (error) {
      logger.error('Error parsing logs:', error.message);
      return parsedLogs;
    }
  }

  /**
   * Get contract state information
   */
  async getContractState(contractAddress, senderAddress) {
    try {
      const contractState = {
        balances: {},
        contractInfo: {}
      };

      // Try to get ERC-20 info
      try {
        const erc20Contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
        
        if (senderAddress) {
          try {
            contractState.balances[senderAddress] = (await erc20Contract.balanceOf(senderAddress)).toString();
          } catch (error) {
            logger.warn('Failed to get ERC-20 balance:', error.message);
          }
        }

        try {
          contractState.contractInfo.symbol = await erc20Contract.symbol();
        } catch (error) {
          // Contract might not have symbol
        }

        try {
          contractState.contractInfo.name = await erc20Contract.name();
        } catch (error) {
          // Contract might not have name
        }

        try {
          contractState.contractInfo.decimals = await erc20Contract.decimals();
        } catch (error) {
          // Contract might not have decimals
        }

      } catch (error) {
        logger.warn('Failed to get ERC-20 contract info:', error.message);
      }

      return contractState;
    } catch (error) {
      logger.error('Error getting contract state:', error.message);
      return {};
    }
  }

  /**
   * Analyze transaction pattern
   */
  analyzeTransactionPattern(transaction, receipt, parsedLogs) {
    const analysis = {
      type: 'unknown',
      success: receipt.status === 1,
      hasTransfers: parsedLogs.transfers.length > 0,
      hasDeposits: parsedLogs.deposits.length > 0,
      contractType: parsedLogs.contractType,
      senderCount: parsedLogs.senderAddresses.length,
      receiverCount: parsedLogs.receiverAddresses.length,
      totalEvents: parsedLogs.transfers.length + parsedLogs.deposits.length + parsedLogs.otherEvents.length
    };

    if (parsedLogs.transfers.length > 0) {
      analysis.type = 'transfer';
    } else if (parsedLogs.deposits.length > 0) {
      analysis.type = 'deposit';
    } else if (transaction.data && transaction.data !== '0x') {
      analysis.type = 'contract_call';
    } else if (transaction.value > 0) {
      analysis.type = 'eth_transfer';
    }

    return analysis;
  }

  /**
   * Cache data in Redis
   */
  async cacheData(key, data, ttl = 3600) {
    if (!this.redisClient) return;
    
    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(data));
      logger.info(`Data cached with key: ${key}`);
    } catch (error) {
      logger.error('Failed to cache data:', error.message);
    }
  }

  /**
   * Get cached data from Redis
   */
  async getCachedData(key) {
    if (!this.redisClient) return null;
    
    try {
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Failed to get cached data:', error.message);
      return null;
    }
  }
}

module.exports = new BlockchainService(); 
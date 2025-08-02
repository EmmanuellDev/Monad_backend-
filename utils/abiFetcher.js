const axios = require('axios');
const logger = require('../config/logger');
const { getRedisClient } = require('../config/database');

class ABIFetcher {
  constructor() {
    this.redisClient = getRedisClient();
    this.explorers = {
      monadscan: {
        baseUrl: 'https://testnet.monadscan.com/api',
        apiKey: process.env.MONADSCAN_API_KEY
      },
      monadexplorer: {
        baseUrl: 'https://testnet.monadexplorer.com/api',
        apiKey: process.env.MONADEXPLORER_API_KEY
      }
    };
  }

  /**
   * Fetch ABI from MonadScan
   */
  async fetchFromMonadScan(contractAddress) {
    try {
      const response = await axios.get(this.explorers.monadscan.baseUrl, {
        params: {
          module: 'contract',
          action: 'getabi',
          address: contractAddress,
          apikey: this.explorers.monadscan.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && response.data.result !== 'Contract source code not verified') {
        logger.info(`ABI fetched from MonadScan for ${contractAddress}`);
        return JSON.parse(response.data.result);
      }
      return null;
    } catch (error) {
      logger.warn(`Failed to fetch ABI from MonadScan: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch transaction logs from MonadScan
   */
  async fetchLogsFromMonadScan(contractAddress, fromBlock = 0, toBlock = 'latest') {
    try {
      const response = await axios.get(this.explorers.monadscan.baseUrl, {
        params: {
          module: 'logs',
          action: 'getLogs',
          fromBlock: fromBlock,
          toBlock: toBlock,
          address: contractAddress,
          apikey: this.explorers.monadscan.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && response.data.result) {
        logger.info(`Logs fetched from MonadScan for ${contractAddress}`);
        return response.data.result;
      }
      return [];
    } catch (error) {
      logger.warn(`Failed to fetch logs from MonadScan: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch ABI from MonadExplorer
   */
  async fetchFromMonadExplorer(contractAddress) {
    try {
      const response = await axios.get(`${this.explorers.monadexplorer.baseUrl}/contracts/${contractAddress}/abi`, {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.abi) {
        logger.info(`ABI fetched from MonadExplorer for ${contractAddress}`);
        return response.data.abi;
      }
      return null;
    } catch (error) {
      logger.warn(`Failed to fetch ABI from MonadExplorer: ${error.message}`);
      return null;
    }
  }

  /**
   * Try multiple sources to fetch ABI
   */
  async fetchABI(contractAddress) {
    // First check cache
    const cachedABI = await this.getCachedABI(contractAddress);
    if (cachedABI) {
      logger.info(`Using cached ABI for ${contractAddress}`);
      return cachedABI;
    }

    // Try MonadScan first
    let abi = await this.fetchFromMonadScan(contractAddress);
    
    // If not found, try MonadExplorer
    if (!abi) {
      abi = await this.fetchFromMonadExplorer(contractAddress);
    }

    // Cache the ABI if found
    if (abi) {
      await this.cacheABI(contractAddress, abi);
    }

    return abi;
  }

  /**
   * Cache ABI in Redis
   */
  async cacheABI(contractAddress, abi) {
    if (!this.redisClient) return;
    
    try {
      const key = `abi:${contractAddress.toLowerCase()}`;
      await this.redisClient.setEx(key, 86400, JSON.stringify(abi)); // Cache for 24 hours
      logger.info(`ABI cached for ${contractAddress}`);
    } catch (error) {
      logger.error('Failed to cache ABI:', error.message);
    }
  }

  /**
   * Get cached ABI from Redis
   */
  async getCachedABI(contractAddress) {
    if (!this.redisClient) return null;
    
    try {
      const key = `abi:${contractAddress.toLowerCase()}`;
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Failed to get cached ABI:', error.message);
      return null;
    }
  }

  /**
   * Parse logs using fetched ABI
   */
  parseLogsWithABI(logs, contractAddress, abi) {
    const { ethers } = require('ethers');
    const parsedLogs = {
      transfers: [],
      failures: [],
      partialTransfers: [],
      contractType: 'Custom',
      contractInfo: {},
      parsedEvents: []
    };

    try {
      const contractInterface = new ethers.Interface(abi);
      
      for (const log of logs) {
        try {
          const parsedLog = contractInterface.parseLog(log);
          
          if (parsedLog) {
            const eventData = {
              name: parsedLog.name,
              args: parsedLog.args.map(arg => arg.toString()),
              logIndex: log.logIndex
            };

            // Categorize events based on name patterns
            if (parsedLog.name.toLowerCase().includes('transfer')) {
              if (parsedLog.name.toLowerCase().includes('failed')) {
                parsedLogs.failures.push({
                  type: parsedLog.name,
                  from: parsedLog.args[0]?.toString(),
                  to: parsedLog.args[1]?.toString(),
                  amount: parsedLog.args[2]?.toString(),
                  reason: parsedLog.args[3]?.toString(),
                  logIndex: log.logIndex
                });
              } else if (parsedLog.name.toLowerCase().includes('partial')) {
                parsedLogs.partialTransfers.push({
                  type: parsedLog.name,
                  from: parsedLog.args[0]?.toString(),
                  to: parsedLog.args[1]?.toString(),
                  requested: parsedLog.args[2]?.toString(),
                  sent: parsedLog.args[3]?.toString(),
                  logIndex: log.logIndex
                });
              } else {
                parsedLogs.transfers.push({
                  type: parsedLog.name,
                  from: parsedLog.args[0]?.toString(),
                  to: parsedLog.args[1]?.toString(),
                  amount: parsedLog.args[2]?.toString(),
                  logIndex: log.logIndex
                });
              }
            }

            parsedLogs.parsedEvents.push(eventData);
          }
        } catch (error) {
          // If parsing fails, add as unknown event
          parsedLogs.parsedEvents.push({
            name: 'Unknown',
            args: [],
            logIndex: log.logIndex,
            error: error.message
          });
        }
      }
    } catch (error) {
      logger.error('Error parsing logs with ABI:', error.message);
    }

    return parsedLogs;
  }
}

module.exports = new ABIFetcher(); 
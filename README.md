# Blockchain Transaction Analyzer

AI-powered blockchain transaction analysis backend for Monad Testnet.

## Features

- **Transaction Analysis**: Extract sender/receiver addresses, block time, and events
- **AI Integration**: Groq AI for intelligent dispute resolution (optional)
- **Multi-Contract Support**: Works with any ERC-20, ERC-721, or custom contract
- **Real-time Analysis**: Analyze any transaction hash and contract address

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```env
   PORT=3000
   NODE_ENV=development
   MONAD_RPC_URL=https://testnet-rpc.monad.xyz
   AI_API_URL=https://api.groq.com/openai/v1/chat/completions
   AI_API_KEY=your_groq_api_key_here
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## API Endpoints

### POST /api/v1/analyze
Analyze any blockchain transaction by extracting sender/receiver addresses, block time, and events.

**Request Body:**
```json
{
  "txHash": "0x701994dbb5e87de72cbd415093ac9827cdf96acab0f34dbf403942822270c9a1",
  "contractAddress": "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89",
  "disputeDescription": "I sent tokens but never received them" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0x701994dbb5e87de72cbd415093ac9827cdf96acab0f34dbf403942822270c9a1",
    "contractAddress": "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89",
    "disputeDescription": "I sent tokens but never received them",
    "aiAnalysis": "Based on the transaction logs... RECOMMENDATION: NO REFUND",
    "transaction": {
      "hash": "0x701994dbb5e87de72cbd415093ac9827cdf96acab0f34dbf403942822270c9a1",
      "blockNumber": 12345678,
      "blockTime": "2024-01-01T12:00:00.000Z",
      "from": "0x1234567890123456789012345678901234567890",
      "to": "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89",
      "value": "0",
      "gasUsed": "21000",
      "status": "success",
      "gasPrice": "20000000000",
      "nonce": 5
    },
    "events": {
      "transfers": [
        {
          "type": "ERC20 Transfer",
          "from": "0x1234567890123456789012345678901234567890",
          "to": "0x9876543210987654321098765432109876543210",
          "value": "1000000000000000000",
          "logIndex": 0,
          "blockNumber": 12345678
        }
      ],
      "deposits": [],
      "otherEvents": [],
      "contractType": "ERC20",
      "senderAddresses": ["0x1234567890123456789012345678901234567890"],
      "receiverAddresses": ["0x9876543210987654321098765432109876543210"]
    },
    "contractState": {
      "balances": {
        "0x1234567890123456789012345678901234567890": "5000000000000000000"
      },
      "contractInfo": {
        "symbol": "USDC",
        "name": "USD Coin",
        "decimals": 6
      }
    },
    "analysis": {
      "type": "transfer",
      "success": true,
      "hasTransfers": true,
      "hasDeposits": false,
      "contractType": "ERC20",
      "senderCount": 1,
      "receiverCount": 1,
      "totalEvents": 1
    }
  }
}
```

### GET /api/v1/health
Health check endpoint.

## What the System Extracts

### Transaction Details
- **Block Number & Time**: When the transaction was executed
- **Sender/Receiver**: The `from` and `to` addresses
- **Value**: ETH amount transferred (if any)
- **Gas Used & Price**: Transaction cost
- **Status**: Success or failed

### Events Analysis
- **ERC-20 Transfers**: Token transfers with amounts
- **ERC-721 Transfers**: NFT transfers with token IDs
- **Deposits**: Deposit events
- **Other Events**: Any other contract events
- **Sender/Receiver Addresses**: All addresses involved in transfers

### Contract State
- **Token Balances**: Current balances for involved addresses
- **Contract Info**: Token symbol, name, decimals (if available)

## Example Usage

### Analyze a Token Transfer
```bash
curl -X POST http://localhost:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0x701994dbb5e87de72cbd415093ac9827cdf96acab0f34dbf403942822270c9a1",
    "contractAddress": "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89"
  }'
```

### Analyze with Dispute Resolution
```bash
curl -X POST http://localhost:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0x701994dbb5e87de72cbd415093ac9827cdf96acab0f34dbf403942822270c9a1",
    "contractAddress": "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89",
    "disputeDescription": "I sent 100 USDC but the recipient claims they never received it"
  }'
```

## Project Structure

```
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
└── server.js        # Main application file
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment | No (default: development) |
| `MONAD_RPC_URL` | Monad Testnet RPC | Yes |
| `AI_API_URL` | Groq AI API URL | No (default: https://api.groq.com/openai/v1/chat/completions) |
| `AI_API_KEY` | Groq AI API key | No (optional for dispute resolution) |

## How It Works

1. **Input**: Transaction hash and contract address
2. **Fetch**: Transaction details, receipt, and block information
3. **Parse**: Extract events and identify sender/receiver addresses
4. **Analyze**: Determine transaction type and contract state
5. **AI Analysis**: If dispute description provided, analyze with Groq AI
6. **Return**: Comprehensive analysis with all extracted data

## License

MIT
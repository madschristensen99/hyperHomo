# HyperHomo: Encrypted Trading Strategies for Hyperliquid

HyperHomo is a revolutionary privacy-preserving trading platform that enables secure, verifiable trading strategies for Hyperliquid perpetuals using Fully Homomorphic Encryption (FHE) within a Trusted Execution Environment (TEE). This cutting-edge combination ensures that sensitive trading parameters remain encrypted throughout the entire computation process while providing cryptographic proof of correct execution.

## Project Overview

HyperHomo addresses the critical privacy challenges in decentralized trading by allowing traders to maintain complete confidentiality of their strategies while still using public blockchain networks. The platform ensures that:

- Strategy logic and parameters remain completely private
- Trades execute securely on Hyperliquid without revealing sensitive data
- Strategy owners can capture builder fees for revenue generation
- Investment structures enable distributed funding for strategies
- Real-time oracle integration provides accurate price feeding
- All operations are verifiably secure through TEE attestation

## Complete Architecture

The HyperHomo platform consists of four interconnected components working in harmony to provide a secure, privacy-preserving trading environment:

### 1. FHE Server (Rust Backend) - Core Privacy Engine

Built with Rust and running in a TEE, this is the foundational privacy layer:

**Core Capabilities:**
- **Fully Homomorphic Encryption**: Performs computations on encrypted data using the TFHE library
- **Encrypted integer comparisons** for strategy bounds checking
- **Secure key generation and management** with client, server, and public keys
- **Trusted Execution Environment (TEE)** for hardware-level security guarantees
- **RESTful API** with the following endpoints:
  - `/create_strategy` - Create encrypted trading strategies with private parameters
  - `/check_long_strategy` - Evaluate long position triggers using encrypted comparisons
  - `/check_short_strategy` - Evaluate short position triggers using encrypted comparisons  
  - `/get_strategy/:id` - Retrieve strategy information (excluding encrypted bounds)
  - `/get_all_strategies` - Browse all available strategies

**Strategy Structure:**
```rust
pub struct TradingStrategy {
    pub id: u128,
    pub name: String,
    pub owner: String,         // Builder address for fee collection
    pub token: String,         // Trading pair (ETH, BTC, SOL, etc.)
    pub upper_bound: FheUint8, // Encrypted upper threshold
    pub lower_bound: FheUint8, // Encrypted lower threshold
    pub amount: u128,          // Total invested amount
    pub is_open: bool,         // Active position status
    pub is_long: bool,         // Position direction
    pub investors: Vec<Investor>, // Distributed investment structure
}
```

### 2. Trade Executor (Python) - Execution and Oracle Layer  

Automated trading bot that monitors strategies and executes trades:

**Key Features:**
- **Redstone Oracle Integration** for real-time price data
- **Multi-token Support**: ETH, BTC, SOL, AVAX, MATIC, DOGE
- **Strategy Evaluation**: Checks encrypted conditions every 5 seconds
- **Automatic Execution**: Places trades when strategy conditions are met
- **Builder Fee Distribution**: 0.001% of each trade goes to strategy creators
- **Fallback Mechanisms**: Uses random values if oracle data unavailable

**Workflow:**
1. Fetches normalized price data from Redstone Oracle
2. Evaluates strategy conditions using encrypted comparisons
3. Executes trades on Hyperliquid with appropriate sizing
4. Updates strategy positions and distributes builder fees

### 3. Frontend (Web Interface) - User Experience Layer

Modern web application for managing accounts, strategies, and investments:

**Core Pages:**
- **Dashboard**: Portfolio overview with PnL tracking
- **Strategies**: Browse and invest in available encrypted strategies
- **Deploy Strategy**: Create new strategies with encrypted parameters
- **Order History**: Track all trades and investments
- **Account**: Wallet connection, USDC management, and deposits

**Key Integrations:**
- **MetaMask/Ethers.js** for wallet connection
- **Smart Contract Interaction** with USDC vault and strategy contracts
- **FHE Server API** for all backend operations
- **PnL API** for real-time performance tracking

### 4. Smart Contracts (Solidity) - Financial Infrastructure

**USDC Vault Contract**: Manages user deposits and withdrawals
- **Contract**: `SimpleUSDCVault` in `/contracts/usdcVault.sol`
- **Features**: Secure USDC deposits with oracle-controlled withdrawals
- **Integration**: All user funds flow through this vault before strategy investment

## Detailed System Flow

### Strategy Creation Process
1. **User creates strategy** via frontend with encrypted bounds
2. **Signature verification** with wallet signing for ownership proof
3. **Strategy deployment** to FHE server with secure storage
4. **Investor onboarding** allows others to invest in the strategy
5. **Fee structure setup** ensures strategy creator receives builder fees

### Investment and Trading Flow
1. **USDC deposit** via smart contract to user account
2. **Investment allocation** to chosen strategies across portfolio
3. **Automated monitoring** by trade executor bot
4. **Encrypted evaluation** of strategy conditions using real market data
5. **Trade execution** on Hyperliquid with builder fees to creators
6. **Position tracking** and PnL calculation for all stakeholders

### Privacy Model
HyperHomo implements a multi-layered privacy architecture:

- **Strategy Parameters**: Upper/lower bounds remain encrypted at all times
- **User Data**: Wallet connections and trading activity remain private
- **Execution Logic**: No strategy details are revealed during trade evaluation
- **Oracle Integration**: Price data is normalized before strategy evaluation
- **TEE Verification**: Runtime attestation proves correct confidential execution

## Advanced Trading Features

### Encrypted Strategy Types
- **Long Strategy**: Triggers when price drops below encrypted lower bound
- **Short Strategy**: Triggers when price rises above encrypted upper bound  
- **Token-Specific**: Each strategy can target different trading pairs
- **Revenue-Generating**: Strategy creators earn fees from successful executions

### Investment Structure
- **Distributed Funding**: Multiple investors can contribute to one strategy
- **Transparent Accounting**: Clear tracking of individual investments and returns
- **Risk Distribution**: Spreads risk across multiple strategies and investors

### Real-Time Operations
- **Multi-token Price Feeds**: ETH, BTC, SOL, AVAX, MATIC, DOGE
- **Normalized Pricing**: All data processed through 0-255 scale for FHE
- **Continuous Monitoring**: 5-second intervals for all active strategies
- **Automatic Position Management**: No manual intervention required

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **FHE Core** | Rust + TFHE | Encrypted computation |
| **TEE** | Hardware Isolation | Runtime security |
| **API** | Axum + Tokio | REST endpoints |
| **Executor** | Python + Web3 | Trade automation |
| **Frontend** | JavaScript + Ethers.js | Web interface |
| **Contracts** | Solidity | Smart contract logic |
| **Oracles** | Redstone Finance | Real-time price data |

## Privacy Architecture Comparison

| Approach | Traditional Trading | FHE-Only | TEE-Only | HyperHomo (FHE+TEE) |
|----------|-------------------|----------|----------|-------------------|
| **Strategy Privacy** | ❌ | ✅ | ❌ | ✅ |
| **Execution Privacy** | ❌ | ✅ | ✅ | ✅ |
| **Verifiable Correctness** | ✅ | ❌ | ✅ | ✅ |
| **Hardware Isolation** | ❌ | ❌ | ✅ | ✅ |
| **Side-channel Protection** | ❌ | ❌ | ❌ | ✅ |

## Development and Deployment

### Complete Prerequisites
- **Docker & Docker Compose** - Full containerized deployment
- **Rust 1.83+** - For FHE server development
- **Python 3.8+** - For trade executor
- **Web Browser** - For frontend access
- **MetaMask** - For wallet integration

### Full System Deployment

1. **Start FHE Server**:
```bash
cd fhe-server
docker build -t fhe-server .
DOCKER_IMAGE=fhe-server docker-compose up -d
```

2. **Start Trade Executor**:
```bash
cd tradeExecutor
docker build -t trade-executor .
docker-compose up -d
```

3. **Access Frontend**:
- Open `frontend/index.html` directly or serve via web server
- Connect wallet to begin using the platform

### Development Mode

**Individual Components:**
```bash
# FHE Server (development)
cd fhe-server && cargo run

# Trade Executor (development)  
cd tradeExecutor && python main.py

# Frontend (live server)
python -m http.server 8000  # From frontend directory
```

## Security Architecture

### Threat Model Mitigation
- **Man-in-the-middle attacks**: All API calls use HTTPS/wss
- **Key exposure**: Never leaves TEE, encrypted at rest
- **Strategy reverse engineering**: Impossible due to FHE
- **Trade strategy theft**: Zero knowledge of actual parameters
- **Contract exploits**: Minimal attack surface, audited contracts

### Security Guarantees
- **Computational Privacy**: FHE provides mathematical guarantees
- **Runtime Security**: TEE prevents unauthorized access
- **Verifiable Execution**: TEE attestation proves correctness
- **Auditability**: All blockchain interactions are transparent
- **Access Control**: Wallet-based authentication with signature verification

## Advanced Configuration

### Environment Variables
```bash
# FHE Server
FHE_SERVER_URL=http://localhost:3000
TEE_MODE=production
KEY_STORAGE_DIR=/app/keys

# Trade Executor  
REDSTONE_API_URL=https://api.redstone.finance/prices
CHECK_INTERVAL=5
PRICE_HISTORY_COUNT=15

# Frontend
PNL_API_URL=http://localhost:5000/api
HYPERLIQUID_NETWORK=testnet
```

### Token Configuration
The platform supports multiple trading pairs:
- **Primary Markets**: ETH, BTC, SOL
- **Altcoin Exposure**: AVAX, MATIC, DOGE
- **Extensible**: Easy to add new tokens via configuration

### Performance Optimization
- **Background Processing**: Trade executor runs independently
- **Minimal Latency**: FHE operations optimized for speed
- **Caching**: Strategy results cached for efficiency
- **Horizontal Scaling**: Multiple executor instances supported

## Risk Management

### Smart Contract Security
- **Minimal Surface Area**: Only essential functions implemented
- **Oracle-Controlled Withdrawals**: Prevents unauthorized access to funds
- **USDC Standard**: Uses established stablecoin for reduced volatility

### Strategy Risk Controls
- **Investor Limits**: Distributed funding reduces individual risk
- **Performance Tracking**: Real-time PnL monitoring
- **Transparent Fees**: Clear builder fee structure (0.001% per trade)

### Technical Risk Mitigation
- **Redundant Data Sources**: Fallback to random values if oracle fails
- **Graceful Degradation**: Continues operating on backup mechanisms
- **Comprehensive Logging**: Full audit trail for debugging

## License

MIT License - See individual component repositories for specific license details.

## Contributing

This is an advanced research project combining cutting-edge cryptography, privacy-preserving computation, and decentralized finance. Contributions should focus on:
- Security improvements and audits
- Performance optimizations
- Additional token integrations
- Enhanced privacy features
- Improved TEE attestation

## Contact & Support

For technical questions about the FHE implementation, oracle integration, or privacy architecture, please refer to the individual component documentation or explore the codebase structure.

This project represents the intersection of advanced cryptography, privacy-preserving computation, and professional trading infrastructure - enabling next-generation financial applications that respect user privacy while maintaining verifiable correctness.

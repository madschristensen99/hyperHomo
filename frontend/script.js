/**
 * Hyper Homo - Frontend JavaScript
 * Handles page navigation, form submissions, and UI interactions
 * Integrates with the FHE server API for encrypted trading strategies
 */

// Import ethers.js library
import { ethers } from "../ethers.min.js";

// Import contract constants
import { HYPERLIQUID_NETWORK, USDC_CONTRACT, VAULT_CONTRACT } from './contracts.js';

// Global variables for wallet connection
let provider;
let signer;
let currentAccount = null;
let isWalletConnected = false;

// Contract instances
let usdcContract;
let vaultContract;

// USDC approval status
let isUsdcApproved = false;

// FHE Server API URL
const API_BASE_URL = 'https://5f2c0532617480427e0633f43274e1d3df471d43-3000.dstack-prod5.phala.network';

// Show the selected page and update navigation
function showPage(pageId, clickEvent) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from all nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
    // Add active class to clicked nav link
    if (clickEvent && clickEvent.target) {
        clickEvent.target.classList.add('active');
    } else {
        // Find the nav link for this page and activate it
        const navLink = document.querySelector(`.nav-link[onclick*="'${pageId}'"`);
        if (navLink) navLink.classList.add('active');
    }
    
    // Load data for specific pages
    if (pageId === 'strategies') {
        loadStrategies();
    } else if (pageId === 'account') {
        // Check if wallet is connected and update UI accordingly
        if (isWalletConnected && currentAccount) {
            updateWalletUI(true);
            getAccountInfo();
        } else {
            updateWalletUI(false);
        }
    }
}

// Export showPage to global scope
window.showPage = showPage;

/**
 * API Functions for FHE Server Integration
 */

// Fetch all available strategies from the FHE server
async function fetchAllStrategies() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_all_strategies`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching strategies:', error);
        return [];
    }
}

// Create a new strategy on the FHE server
async function createStrategy(name, upperBound, lowerBound, owner, signature) {
    try {
        const response = await fetch(`${API_BASE_URL}/create_strategy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                upper_bound: parseInt(upperBound),
                lower_bound: parseInt(lowerBound),
                owner,
                signature // Include the signature to verify ownership
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response.text();
    } catch (error) {
        console.error('Error creating strategy:', error);
        throw error;
    }
}

// Check if a value is below the lower bound (for long strategy)
async function checkLongStrategy(strategyId, value) {
    try {
        const response = await fetch(`${API_BASE_URL}/check_long_strategy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                strategy_id: strategyId,
                value: parseInt(value)
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response.text();
    } catch (error) {
        console.error('Error checking long strategy:', error);
        throw error;
    }
}

// Check if a value is above the upper bound (for short strategy)
async function checkShortStrategy(strategyId, value) {
    try {
        const response = await fetch(`${API_BASE_URL}/check_short_strategy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                strategy_id: strategyId,
                value: parseInt(value)
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response.text();
    } catch (error) {
        console.error('Error checking short strategy:', error);
        throw error;
    }
}

// Get a specific strategy by ID
async function getStrategy(strategyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/get_strategy/${strategyId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching strategy:', error);
        throw error;
    }
}

/**
 * USDC and Deposit Functions
 */

// Initialize contract instances
function initializeContracts() {
    if (!provider || !signer) return false;
    
    try {
        // Initialize USDC contract
        usdcContract = new ethers.Contract(
            USDC_CONTRACT.address,
            USDC_CONTRACT.abi,
            signer
        );
        
        // Initialize Vault contract
        vaultContract = new ethers.Contract(
            VAULT_CONTRACT.address,
            VAULT_CONTRACT.abi,
            signer
        );
        
        return true;
    } catch (error) {
        console.error('Error initializing contracts:', error);
        return false;
    }
}

// Check if the Hyperliquid network is configured
async function checkAndSwitchNetwork() {
    if (!window.ethereum) return false;
    
    try {
        // Get current chain ID
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(chainId, 16);
        
        // If not on Hyperliquid network, prompt to switch
        if (currentChainId !== HYPERLIQUID_NETWORK.chainId) {
            try {
                // Try to switch to Hyperliquid network
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${HYPERLIQUID_NETWORK.chainId.toString(16)}` }],
                });
                return true;
            } catch (switchError) {
                // If network doesn't exist in wallet, add it
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: `0x${HYPERLIQUID_NETWORK.chainId.toString(16)}`,
                                chainName: HYPERLIQUID_NETWORK.chainName,
                                rpcUrls: [HYPERLIQUID_NETWORK.rpcUrl],
                                blockExplorerUrls: [HYPERLIQUID_NETWORK.blockExplorerUrl],
                                nativeCurrency: HYPERLIQUID_NETWORK.nativeCurrency
                            }],
                        });
                        return true;
                    } catch (addError) {
                        console.error('Error adding Hyperliquid network:', addError);
                        return false;
                    }
                }
                console.error('Error switching to Hyperliquid network:', switchError);
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Error checking network:', error);
        return false;
    }
}

// Get USDC balance
async function getUsdcBalance() {
    if (!usdcContract || !currentAccount) return '0';
    
    try {
        const balance = await usdcContract.balanceOf(currentAccount);
        return ethers.formatUnits(balance, USDC_CONTRACT.decimals);
    } catch (error) {
        console.error('Error getting USDC balance:', error);
        return '0';
    }
}

// Get deposited USDC amount
async function getDepositedUsdc() {
    if (!vaultContract || !currentAccount) return '0';
    
    try {
        const deposited = await vaultContract.getUserBalance(currentAccount);
        return ethers.formatUnits(deposited, USDC_CONTRACT.decimals);
    } catch (error) {
        console.error('Error getting deposited USDC:', error);
        return '0';
    }
}

// Check USDC allowance
async function checkUsdcAllowance() {
    if (!usdcContract || !currentAccount) return false;
    
    try {
        const allowance = await usdcContract.allowance(currentAccount, VAULT_CONTRACT.address);
        const minAllowance = ethers.parseUnits('1', USDC_CONTRACT.decimals); // At least 1 USDC
        isUsdcApproved = allowance.gte(minAllowance);
        return isUsdcApproved;
    } catch (error) {
        console.error('Error checking USDC allowance:', error);
        return false;
    }
}

// Approve USDC spending
async function approveUsdc() {
    if (!usdcContract || !currentAccount) {
        throw new Error('USDC contract not initialized or wallet not connected');
    }
    
    try {
        // Set status to pending
        updateDepositStatus('Approving USDC...', 'pending');
        
        // Approve a large amount (effectively unlimited)
        const maxAmount = ethers.parseUnits('1000000', USDC_CONTRACT.decimals);
        const tx = await usdcContract.approve(VAULT_CONTRACT.address, maxAmount);
        
        // Wait for transaction to be mined
        updateDepositStatus('Waiting for approval transaction...', 'pending');
        await tx.wait();
        
        // Update status
        isUsdcApproved = true;
        updateDepositStatus('USDC approved successfully!', 'success');
        document.getElementById('deposit-usdc-btn').disabled = false;
        document.getElementById('approve-usdc-btn').disabled = true;
        
        return true;
    } catch (error) {
        console.error('Error approving USDC:', error);
        updateDepositStatus(`Error approving USDC: ${error.message}`, 'error');
        throw error;
    }
}

// Deposit USDC to vault
async function depositUsdc(amount) {
    if (!vaultContract || !currentAccount || !isUsdcApproved) {
        throw new Error('Vault contract not initialized, wallet not connected, or USDC not approved');
    }
    
    try {
        // Convert amount to wei
        const amountInWei = ethers.parseUnits(amount.toString(), USDC_CONTRACT.decimals);
        
        // Set status to pending
        updateDepositStatus('Depositing USDC...', 'pending');
        
        // Deposit USDC
        const tx = await vaultContract.deposit(amountInWei);
        
        // Wait for transaction to be mined
        updateDepositStatus('Waiting for deposit transaction...', 'pending');
        await tx.wait();
        
        // Update status
        updateDepositStatus('USDC deposited successfully!', 'success');
        
        // Update balances
        await updateBalances();
        
        return true;
    } catch (error) {
        console.error('Error depositing USDC:', error);
        updateDepositStatus(`Error depositing USDC: ${error.message}`, 'error');
        throw error;
    }
}

// Update deposit status message
function updateDepositStatus(message, status) {
    const statusElement = document.getElementById('deposit-status');
    if (!statusElement) return;
    
    // Remove all status classes
    statusElement.classList.remove('status-pending', 'status-success', 'status-error');
    
    // Add appropriate class based on status
    if (status) {
        statusElement.classList.add(`status-${status}`);
    }
    
    // Update message
    statusElement.textContent = message;
    statusElement.style.display = message ? 'block' : 'none';
}

// Update USDC and deposited balances
async function updateBalances() {
    if (!isWalletConnected || !currentAccount) return;
    
    try {
        // Get USDC balance
        const usdcBalance = await getUsdcBalance();
        document.getElementById('usdc-balance').textContent = `${parseFloat(usdcBalance).toFixed(2)} USDC`;
        
        // Get deposited USDC
        const depositedUsdc = await getDepositedUsdc();
        document.getElementById('deposited-usdc').textContent = `${parseFloat(depositedUsdc).toFixed(2)} USDC`;
        
        // Check USDC allowance
        const isApproved = await checkUsdcAllowance();
        document.getElementById('deposit-usdc-btn').disabled = !isApproved;
        document.getElementById('approve-usdc-btn').disabled = isApproved;
    } catch (error) {
        console.error('Error updating balances:', error);
    }
}

/**
 * Wallet Connection Functions
 */

// Sign a message with the connected wallet to verify ownership
async function signMessage(message) {
    if (!isWalletConnected || !signer) {
        throw new Error('Wallet not connected');
    }
    
    try {
        // Sign the message with the connected wallet
        const signature = await signer.signMessage(message);
        return {
            message,
            signature,
            address: currentAccount
        };
    } catch (error) {
        console.error('Error signing message:', error);
        throw error;
    }
}

// Connect to MetaMask or other Ethereum wallet
async function connectWallet() {
    try {
        // Check if MetaMask is installed
        if (window.ethereum) {
            // Check and switch to Hyperliquid network if needed
            const networkSwitched = await checkAndSwitchNetwork();
            if (!networkSwitched) {
                alert('Please switch to the Hyperliquid network to continue.');
                return false;
            }
            
            // Create a new provider using the injected provider
            provider = new ethers.BrowserProvider(window.ethereum);
            
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // Get the signer
            signer = await provider.getSigner();
            
            // Get the connected account
            currentAccount = accounts[0];
            
            // Initialize contract instances
            const contractsInitialized = initializeContracts();
            if (!contractsInitialized) {
                console.error('Failed to initialize contracts');
            }
            
            // Update UI to show connected state
            updateWalletUI(true);
            
            // Get and display account information
            await getAccountInfo();
            
            // Update USDC and deposited balances
            await updateBalances();
            
            // Set up event listeners for account changes
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', () => window.location.reload());
            
            return true;
        } else {
            alert('MetaMask is not installed. Please install it to use this feature.');
            return false;
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert(`Error connecting wallet: ${error.message}`);
        return false;
    }
}

// Handle account changes
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected their wallet
        disconnectWallet();
    } else if (accounts[0] !== currentAccount) {
        // User switched accounts
        currentAccount = accounts[0];
        
        // Update the UI with the new account
        updateWalletUI(true);
        await getAccountInfo();
    }
}

// Disconnect wallet
function disconnectWallet() {
    currentAccount = null;
    isWalletConnected = false;
    provider = null;
    signer = null;
    
    // Update UI to show disconnected state
    updateWalletUI(false);
}

// Update UI based on wallet connection status
function updateWalletUI(connected) {
    isWalletConnected = connected;
    
    const walletNotConnectedDiv = document.getElementById('wallet-not-connected');
    const walletConnectedDiv = document.getElementById('wallet-connected');
    const walletAddressSpan = document.getElementById('wallet-address');
    
    if (connected && currentAccount) {
        // Show connected UI
        walletNotConnectedDiv.style.display = 'none';
        walletConnectedDiv.style.display = 'block';
        
        // Update address display
        walletAddressSpan.textContent = truncateAddress(currentAccount);
    } else {
        // Show not connected UI
        walletNotConnectedDiv.style.display = 'flex';
        walletConnectedDiv.style.display = 'none';
        
        // Reset values
        document.getElementById('total-balance').textContent = '--';
        document.getElementById('available-balance').textContent = '--';
        document.getElementById('in-positions').textContent = '--';
        document.getElementById('total-pnl').textContent = '--';
        
        // Clear trades table
        const tradesTableBody = document.getElementById('trades-table-body');
        tradesTableBody.innerHTML = `
            <tr class="no-trades-row">
                <td colspan="6" class="no-data-message">No recent trades found</td>
            </tr>
        `;
    }
}

// Get account information
async function getAccountInfo() {
    if (!isWalletConnected || !currentAccount) return;
    
    try {
        // Get ETH balance
        const balance = await provider.getBalance(currentAccount);
        const ethBalance = ethers.formatEther(balance);
        
        // In a real application, you would fetch actual data from your backend
        // For this demo, we'll use mock data
        const totalBalance = parseFloat(ethBalance) * 2000; // Mock conversion to USD
        const inPositions = totalBalance * 0.7; // 70% in positions
        const availableBalance = totalBalance - inPositions;
        const pnl = '+12.5%'; // Mock P&L
        
        // Update UI with account information
        document.getElementById('total-balance').textContent = `$${totalBalance.toFixed(2)}`;
        document.getElementById('available-balance').textContent = `$${availableBalance.toFixed(2)}`;
        document.getElementById('in-positions').textContent = `$${inPositions.toFixed(2)}`;
        document.getElementById('total-pnl').textContent = pnl;
        
        // Load mock trades
        loadMockTrades();
        
        // Update USDC and deposited balances
        await updateBalances();
    } catch (error) {
        console.error('Error getting account info:', error);
    }
}

// Load mock trades for demonstration
function loadMockTrades() {
    const mockTrades = [
        { pair: 'BTC-USD', side: 'LONG', size: '0.5 BTC', price: '$43,247', pnl: '+$1,247', time: '2 hours ago', profit: true },
        { pair: 'ETH-USD', side: 'SHORT', size: '2.3 ETH', price: '$2,847', pnl: '-$389', time: '5 hours ago', profit: false },
        { pair: 'SOL-USD', side: 'LONG', size: '15 SOL', price: '$127.45', pnl: '+$567', time: '1 day ago', profit: true },
        { pair: 'AVAX-USD', side: 'LONG', size: '50 AVAX', price: '$32.78', pnl: '+$234', time: '2 days ago', profit: true }
    ];
    
    const tradesTableBody = document.getElementById('trades-table-body');
    tradesTableBody.innerHTML = '';
    
    mockTrades.forEach(trade => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${trade.pair}</td>
            <td>${trade.side}</td>
            <td>${trade.size}</td>
            <td>${trade.price}</td>
            <td class="${trade.profit ? 'profit' : 'loss'}">${trade.pnl}</td>
            <td>${trade.time}</td>
        `;
        tradesTableBody.appendChild(row);
    });
}

// Copy wallet address to clipboard
function copyWalletAddress() {
    if (currentAccount) {
        navigator.clipboard.writeText(currentAccount)
            .then(() => {
                alert('Address copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy address:', err);
            });
    }
}

/**
 * UI Functions
 */

// Load and display strategies in the UI
async function loadStrategies() {
    const strategyGrid = document.querySelector('.strategy-grid');
    if (!strategyGrid) return;
    
    // Show loading state
    strategyGrid.innerHTML = '<div class="loading">Loading strategies...</div>';
    
    try {
        const strategies = await fetchAllStrategies();
        
        if (strategies.length === 0) {
            strategyGrid.innerHTML = '<div class="no-strategies">No strategies available yet. Create one!</div>';
            return;
        }
        
        // Clear loading state
        strategyGrid.innerHTML = '';
        
        // Add each strategy to the grid
        strategies.forEach((strategy, index) => {
            const strategyCard = document.createElement('div');
            strategyCard.className = 'strategy-card';
            
            // Check if this strategy is owned by the connected wallet
            const isOwnedByUser = isWalletConnected && currentAccount && 
                                  strategy.owner.toLowerCase() === currentAccount.toLowerCase();
            
            if (isOwnedByUser) {
                strategyCard.classList.add('owned-strategy');
            }
            
            strategyCard.innerHTML = `
                <div class="strategy-image">${getStrategyEmoji(index)}</div>
                <div class="strategy-name">${strategy.name}</div>
                <div class="strategy-performance">
                    Owner: ${truncateAddress(strategy.owner)}
                    ${isOwnedByUser ? '<span class="owner-badge">Your Strategy</span>' : ''}
                </div>
                <button class="copy-btn" onclick="copyStrategy('${strategy.name}')">Copy Strategy</button>
            `;
            strategyGrid.appendChild(strategyCard);
        });
    } catch (error) {
        strategyGrid.innerHTML = `<div class="error">Error loading strategies: ${error.message}</div>`;
    }
}

// Helper function to get emoji for strategy card
function getStrategyEmoji(index) {
    const emojis = ['📊', '🌊', '⚡', '🎯', '🔥', '🎲'];
    return emojis[index % emojis.length];
}

// Helper function to truncate Ethereum address
function truncateAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Copy strategy functionality
function copyStrategy(strategyName) {
    // In a real app, this would copy the strategy to the user's account
    alert(`Strategy "${strategyName}" copied to your account! You can now deploy it from the Deploy Strategy page.`);
}

// Place an order using a strategy
async function placeOrder(formData) {
    // This would integrate with Hyperliquid API in a real implementation
    // For now, we'll just simulate an order placement
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ success: true, message: 'Order placed successfully!' });
        }, 1000);
    });
}

// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add click event listeners to nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Extract page ID from the onclick attribute
            const onclickAttr = this.getAttribute('onclick');
            if (onclickAttr) {
                const pageIdMatch = onclickAttr.match(/showPage\('([^']+)'\)/); 
                if (pageIdMatch && pageIdMatch[1]) {
                    e.preventDefault();
                    showPage(pageIdMatch[1], e);
                }
            }
        });
    });
    // Form submission handlers
    const deployForm = document.getElementById('deployForm');
    if (deployForm) {
        deployForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check if wallet is connected
            if (!isWalletConnected || !currentAccount) {
                alert('Please connect your wallet first to deploy a strategy');
                showPage('account');
                return;
            }
            
            const nameInput = this.querySelector('input[placeholder="Enter strategy name"]');
            const indicatorSelect = this.querySelector('select');
            const upperBoundInput = this.querySelector('input[placeholder="Upper limit"]');
            const lowerBoundInput = this.querySelector('input[placeholder="Lower limit"]');
            
            if (!nameInput || !indicatorSelect || !upperBoundInput || !lowerBoundInput) {
                alert('Form fields not found!');
                return;
            }
            
            const name = nameInput.value.trim();
            const indicator = indicatorSelect.value;
            const upperBound = upperBoundInput.value;
            const lowerBound = lowerBoundInput.value;
            
            // Simple validation
            if (!name || !indicator || !upperBound || !lowerBound) {
                alert('Please fill in all fields!');
                return;
            }
            
            // Use the connected wallet address as the owner
            const owner = currentAccount;
            
            // Store submit button reference and original text outside try/catch
            const submitBtn = this.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            
            try {
                // Show loading state
                submitBtn.textContent = 'Creating Strategy...';
                submitBtn.disabled = true;
                
                // Sign a message to verify ownership
                const strategyMessage = `I am creating a strategy named "${name} (${indicator})" with bounds ${lowerBound}-${upperBound}`;
                const signedData = await signMessage(strategyMessage);
                
                // Create the strategy with signed verification
                const result = await createStrategy(
                    `${name} (${indicator})`, 
                    upperBound, 
                    lowerBound, 
                    owner,
                    signedData.signature
                );
                
                // Reset form
                this.reset();
                
                // Show success message
                alert('Strategy deployed successfully! Your encrypted strategy is now running.');
                
                // Refresh strategies list if on strategies page
                if (document.getElementById('strategies').classList.contains('active')) {
                    loadStrategies();
                }
            } catch (error) {
                alert(`Error creating strategy: ${error.message}`);
            } finally {
                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check if wallet is connected
            if (!isWalletConnected || !currentAccount) {
                alert('Please connect your wallet first to place an order');
                showPage('account');
                return;
            }
            
            const pairSelect = this.querySelector('select[required]:nth-of-type(1)');
            const orderTypeSelect = this.querySelector('select[required]:nth-of-type(2)');
            const sideSelect = this.querySelector('select[required]:nth-of-type(3)');
            const quantityInput = this.querySelector('input[placeholder="Amount"]');
            const priceInput = this.querySelector('input[placeholder="Price"]');
            const leverageSelect = this.querySelector('select:last-of-type');
            
            if (!pairSelect || !orderTypeSelect || !sideSelect || !quantityInput) {
                alert('Form fields not found!');
                return;
            }
            
            const pair = pairSelect.value;
            const orderType = orderTypeSelect.value;
            const side = sideSelect.value;
            const quantity = quantityInput.value;
            const price = priceInput?.value || '0';
            const leverage = leverageSelect?.value || '1';
            
            // Simple validation
            if (!pair || !orderType || !side || !quantity) {
                alert('Please fill in all required fields!');
                return;
            }
            
            // Store submit button reference and original text outside try/catch
            const submitBtn = this.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            
            try {
                // Show loading state
                submitBtn.textContent = 'Placing Order...';
                submitBtn.disabled = true;
                
                // Place the order
                const result = await placeOrder({
                    pair, orderType, side, quantity, price, leverage
                });
                
                // Reset form
                this.reset();
                
                // Show success message
                alert('Encrypted order placed successfully! Your order is being processed securely.');
            } catch (error) {
                alert(`Error placing order: ${error.message}`);
            } finally {
                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Add interactive animations to cards
    const cards = document.querySelectorAll('.feature-card, .strategy-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Load strategies if on strategies page
    if (document.getElementById('strategies').classList.contains('active')) {
        loadStrategies();
    }
    
    // Add event listener for the "Create New Strategy" button
    const createStrategyBtn = document.querySelector('.action-btn[onclick="showPage(\'deploy\')"]');
    if (createStrategyBtn) {
        createStrategyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('deploy', e);
        });
    }
    
    // Add event listeners for wallet connection buttons
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', async function() {
            await connectWallet();
        });
    }
    
    const disconnectWalletBtn = document.getElementById('disconnect-wallet-btn');
    if (disconnectWalletBtn) {
        disconnectWalletBtn.addEventListener('click', function() {
            disconnectWallet();
        });
    }
    
    const copyAddressBtn = document.getElementById('copy-address-btn');
    if (copyAddressBtn) {
        copyAddressBtn.addEventListener('click', function() {
            copyWalletAddress();
        });
    }
    
    // Add event listeners for USDC deposit form
    const approveUsdcBtn = document.getElementById('approve-usdc-btn');
    if (approveUsdcBtn) {
        approveUsdcBtn.addEventListener('click', async function() {
            if (!isWalletConnected) {
                alert('Please connect your wallet first');
                return;
            }
            
            try {
                this.disabled = true;
                await approveUsdc();
            } catch (error) {
                console.error('Error in approve button handler:', error);
                this.disabled = false;
            }
        });
    }
    
    const depositForm = document.getElementById('deposit-form');
    if (depositForm) {
        depositForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!isWalletConnected) {
                alert('Please connect your wallet first');
                return;
            }
            
            if (!isUsdcApproved) {
                alert('Please approve USDC spending first');
                return;
            }
            
            const amountInput = document.getElementById('deposit-amount');
            const amount = amountInput.value;
            
            if (!amount || parseFloat(amount) <= 0) {
                alert('Please enter a valid amount');
                return;
            }
            
            const depositBtn = document.getElementById('deposit-usdc-btn');
            
            try {
                depositBtn.disabled = true;
                await depositUsdc(amount);
                amountInput.value = ''; // Clear the input after successful deposit
            } catch (error) {
                console.error('Error in deposit form handler:', error);
            } finally {
                depositBtn.disabled = !isUsdcApproved;
            }
        });
    }
    
    // Check if wallet is already connected (e.g., from a previous session)
    if (window.ethereum && window.ethereum.isConnected()) {
        try {
            // Try to reconnect silently
            window.ethereum.request({ method: 'eth_accounts' })
                .then(accounts => {
                    if (accounts.length > 0) {
                        // If we have accounts, reconnect
                        connectWallet();
                    }
                })
                .catch(error => {
                    console.error('Error checking accounts:', error);
                });
        } catch (error) {
            console.error('Error checking wallet connection:', error);
        }
    }
});


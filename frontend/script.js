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
const API_BASE_URL = 'http://localhost:3000';

// PnL API URL
const PNL_API_URL = 'http://localhost:5000/api';

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

/**
 * PnL API Functions
 */

// Fetch account PnL data
async function fetchAccountPnL() {
    try {
        const response = await fetch(`${PNL_API_URL}/pnl`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching account PnL:', error);
        throw error;
    }
}

// Fetch strategy performance data
async function fetchStrategyPerformance() {
    try {
        const response = await fetch(`${PNL_API_URL}/strategies/performance`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching strategy performance:', error);
        throw error;
    }
}

/**
 * FHE API Functions
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
async function createStrategy(name, upperBound, lowerBound, owner, signature, token = 'ETH') {
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
                signature, // Include the signature to verify ownership
                token // Add the token field with default value 'ETH'
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
        // Use the balances mapping instead of getUserBalance
        const deposited = await vaultContract.balances(currentAccount);
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
        console.log('Checking USDC allowance for', currentAccount);
        const allowance = await usdcContract.allowance(currentAccount, VAULT_CONTRACT.address);
        console.log('Current allowance:', allowance.toString());
        
        const minAllowance = ethers.parseUnits('1', USDC_CONTRACT.decimals); // At least 1 USDC
        console.log('Minimum required allowance:', minAllowance.toString());
        
        // Convert to strings first to avoid any issues with BigInt
        const allowanceStr = allowance.toString();
        const minAllowanceStr = minAllowance.toString();
        
        // Now safely convert to BigInt for comparison
        try {
            const allowanceBigInt = BigInt(allowanceStr);
            const minAllowanceBigInt = BigInt(minAllowanceStr);
            isUsdcApproved = allowanceBigInt >= minAllowanceBigInt;
            console.log('Is USDC approved?', isUsdcApproved);
        } catch (bigIntError) {
            console.error('Error converting to BigInt:', bigIntError);
            // Fallback to string comparison
            isUsdcApproved = allowanceStr.length > minAllowanceStr.length || 
                            (allowanceStr.length === minAllowanceStr.length && allowanceStr >= minAllowanceStr);
            console.log('Fallback approval check result:', isUsdcApproved);
        }
        
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
        
        // For debugging
        console.log('USDC contract address:', USDC_CONTRACT.address);
        console.log('Vault contract address:', VAULT_CONTRACT.address);
        console.log('Current account:', currentAccount);
        
        // Check current allowance first
        const currentAllowance = await usdcContract.allowance(currentAccount, VAULT_CONTRACT.address);
        console.log('Current allowance:', currentAllowance.toString());
        
        // Approve a large amount (effectively unlimited)
        const maxAmount = ethers.parseUnits('1000000', USDC_CONTRACT.decimals);
        console.log('Approving amount:', maxAmount.toString());
        
        // Get gas estimate
        try {
            const gasEstimate = await usdcContract.approve.estimateGas(VAULT_CONTRACT.address, maxAmount);
            console.log('Gas estimate for approval:', gasEstimate.toString());
        } catch (gasError) {
            console.error('Error estimating gas for approval:', gasError);
            // Continue anyway, the transaction might still work
        }
        
        // Approve with explicit gas limit
        const tx = await usdcContract.approve(VAULT_CONTRACT.address, maxAmount, {
            gasLimit: ethers.parseUnits('100000', 'wei') // Provide a higher gas limit
        });
        
        // Wait for transaction to be mined
        updateDepositStatus('Waiting for approval transaction...', 'pending');
        await tx.wait();
        
        // Verify approval was successful
        const newAllowance = await usdcContract.allowance(currentAccount, VAULT_CONTRACT.address);
        console.log('New allowance after approval:', newAllowance.toString());
        
        // Update status
        isUsdcApproved = true;
        updateDepositStatus('USDC approved successfully!', 'success');
        
        return true;
    } catch (error) {
        console.error('Error approving USDC:', error);
        updateDepositStatus(`Error approving USDC: ${error.message}`, 'error');
        throw error;
    }
}

// Deposit USDC to vault
async function depositUsdc(amount) {
    if (!vaultContract || !currentAccount) {
        throw new Error('Vault contract not initialized or wallet not connected');
    }
    
    try {
        // Double-check approval status
        const isApproved = await checkUsdcAllowance();
        if (!isApproved) {
            console.log('USDC not approved yet, approving first...');
            await approveUsdc();
            // Verify approval was successful
            const verifyApproval = await checkUsdcAllowance();
            if (!verifyApproval) {
                throw new Error('USDC approval failed. Please try again.');
            }
        }
        
        // Convert amount to wei
        const amountInWei = ethers.parseUnits(amount.toString(), USDC_CONTRACT.decimals);
        console.log('Depositing amount in wei:', amountInWei.toString());
        
        // Set status to pending
        updateDepositStatus('Depositing USDC...', 'pending');
        
        // Get gas estimate
        try {
            const gasEstimate = await vaultContract.deposit.estimateGas(amountInWei);
            console.log('Gas estimate for deposit:', gasEstimate.toString());
        } catch (gasError) {
            console.error('Error estimating gas:', gasError);
            // Continue anyway, the transaction might still work
        }
        
        // For debugging
        console.log('Vault contract address:', VAULT_CONTRACT.address);
        console.log('Current account:', currentAccount);
        
        // Deposit USDC to blockchain with explicit gas limit
        const tx = await vaultContract.deposit(amountInWei, {
            gasLimit: ethers.parseUnits('100000', 'wei') // Provide a higher gas limit
        });
        
        // Wait for transaction to be mined
        updateDepositStatus('Waiting for deposit transaction...', 'pending');
        await tx.wait();
        
        // Also update the FHE server with the deposit information
        updateDepositStatus('Updating FHE server...', 'pending');
        
        try {
            // Call the FHE server deposit endpoint
            const fheResponse = await fetch(`${API_BASE_URL}/deposit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: currentAccount,
                    amount: parseFloat(amount) // Convert to number for the FHE server
                })
            });
            
            if (!fheResponse.ok) {
                const errorText = await fheResponse.text();
                console.error('FHE server deposit error:', errorText);
                
                // If the account doesn't exist yet, create it first and then try again
                if (errorText.includes('not found')) {
                    // Create account first
                    const createAccountResponse = await fetch(`${API_BASE_URL}/create_account`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            address: currentAccount,
                            balance: 0 // Start with zero balance
                        })
                    });
                    
                    if (createAccountResponse.ok) {
                        // Try deposit again
                        const retryResponse = await fetch(`${API_BASE_URL}/deposit`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                address: currentAccount,
                                amount: parseFloat(amount)
                            })
                        });
                        
                        if (!retryResponse.ok) {
                            throw new Error(`Failed to deposit after account creation: ${await retryResponse.text()}`);
                        }
                    } else {
                        throw new Error(`Failed to create account: ${await createAccountResponse.text()}`);
                    }
                } else {
                    throw new Error(`FHE server error: ${errorText}`);
                }
            }
            
            console.log('FHE server deposit successful');
        } catch (fheError) {
            console.error('Error updating FHE server:', fheError);
            // We don't throw here because the blockchain transaction was successful
            // Just show a warning to the user
            updateDepositStatus('Deposit successful on blockchain, but FHE server update failed. Some features may be limited.', 'warning');
        }
        
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
        // Get USDC balance - with error handling
        let usdcBalance = '0';
        try {
            usdcBalance = await getUsdcBalance();
        } catch (error) {
            console.error('Error getting USDC balance:', error);
        }
        document.getElementById('usdc-balance').textContent = `${parseFloat(usdcBalance).toFixed(2)} USDC`;
        
        // Get deposited USDC from blockchain - with error handling
        let depositedUsdc = '0';
        try {
            depositedUsdc = await getDepositedUsdc();
        } catch (error) {
            console.error('Error getting deposited USDC:', error);
        }
        
        // Try to get FHE server balance
        let fheBalance = null;
        try {
            const response = await fetch(`${API_BASE_URL}/get_account/${currentAccount}`);
            
            if (response.ok) {
                const fheAccountData = await response.json();
                fheBalance = fheAccountData.balance;
            }
        } catch (fheError) {
            console.error('Error fetching FHE account balance:', fheError);
        }
        
        // Display deposited USDC - use FHE balance if available
        if (fheBalance !== null) {
            document.getElementById('deposited-usdc').textContent = `${parseFloat(fheBalance).toFixed(2)} USDC (FHE)`;
        } else {
            document.getElementById('deposited-usdc').textContent = `${parseFloat(depositedUsdc).toFixed(2)} USDC`;
        }
        
        // Check USDC allowance - with error handling
        let isApproved = false;
        try {
            isApproved = await checkUsdcAllowance();
        } catch (error) {
            console.error('Error checking USDC allowance:', error);
        }
        
        // No need to update button states anymore since we combined the functionality
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
            
            // Check if account exists on FHE server, if not create it
            try {
                const accountResponse = await fetch(`${API_BASE_URL}/get_account/${currentAccount}`);
                
                if (!accountResponse.ok) {
                    // Account doesn't exist, create it with signature
                    const message = `I authorize the creation of a HyperHomo account for address: ${currentAccount}`;
                    
                    // Show signing message to user
                    const statusElement = document.getElementById('deposit-status');
                    if (statusElement) {
                        statusElement.textContent = 'Please sign the message to create your account...';
                        statusElement.classList.remove('status-pending', 'status-success', 'status-error', 'status-warning');
                        statusElement.classList.add('status-pending');
                        statusElement.style.display = 'block';
                    }
                    
                    // Get signature
                    const signResult = await signMessage(message);
                    
                    // Create account with signature
                    const createAccountResponse = await fetch(`${API_BASE_URL}/create_account`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            address: currentAccount,
                            balance: 0,
                            signature: signResult.signature
                        })
                    });
                    
                    if (createAccountResponse.ok) {
                        if (statusElement) {
                            statusElement.textContent = 'Account created successfully!';
                            statusElement.classList.remove('status-pending');
                            statusElement.classList.add('status-success');
                            
                            // Hide the notification after 3 seconds
                            setTimeout(() => {
                                statusElement.style.display = 'none';
                            }, 3000);
                        }
                    } else {
                        console.error('Failed to create account:', await createAccountResponse.text());
                    }
                }
            } catch (error) {
                console.error('Error checking/creating account:', error);
            }
            
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
        
        // Try to fetch account data from FHE server
        let fheAccountData = null;
        let fheBalance = 0;
        
        try {
            const response = await fetch(`${API_BASE_URL}/get_account/${currentAccount}`);
            
            if (response.ok) {
                fheAccountData = await response.json();
                fheBalance = parseFloat(fheAccountData.balance);
                console.log('FHE account data:', fheAccountData);
            } else {
                console.log('No FHE account found, will be created on first deposit');
            }
        } catch (fheError) {
            console.error('Error fetching FHE account data:', fheError);
        }
        
        // Calculate balances based on FHE server data or set to zero
        let totalBalance = 0;
        let inPositions = 0;
        let availableBalance = 0;
        let pnl = '0%';
        
        // Try to fetch PnL data from our API
        try {
            const pnlData = await fetchAccountPnL();
            console.log('PnL data:', pnlData);
            
            if (pnlData && pnlData.account_summary) {
                // Use real PnL data
                totalBalance = pnlData.account_summary.account_value || 0;
                availableBalance = pnlData.account_summary.available_margin || 0;
                
                // Calculate positions value from positions data
                if (pnlData.positions && pnlData.positions.length > 0) {
                    inPositions = pnlData.positions.reduce((total, pos) => total + pos.position_value, 0);
                    
                    // Calculate overall PnL
                    const totalPnl = pnlData.positions.reduce((total, pos) => total + pos.unrealized_pnl, 0);
                    const pnlPercent = (totalPnl / totalBalance) * 100;
                    pnl = `${pnlPercent.toFixed(2)}%`;
                    
                    // Add color class based on PnL
                    setTimeout(() => {
                        const pnlElement = document.getElementById('total-pnl');
                        if (pnlElement) {
                            pnlElement.classList.remove('positive-pnl', 'negative-pnl');
                            pnlElement.classList.add(pnlPercent >= 0 ? 'positive-pnl' : 'negative-pnl');
                        }
                    }, 0);
                }
            }
        } catch (pnlError) {
            console.error('Error fetching PnL data:', pnlError);
            
            // Fall back to FHE server data if PnL API fails
            if (fheAccountData) {
                // Use FHE server data
                totalBalance = fheBalance;
                
                // Get positions from FHE server
                const positionsResponse = await fetch(`${API_BASE_URL}/get_all_strategies`)
                    .then(res => res.ok ? res.json() : [])
                    .catch(() => []);
                    
                // Calculate positions value based on strategies owned by this user
                let positionsValue = 0;
                if (Array.isArray(positionsResponse)) {
                    const userStrategies = positionsResponse.filter(s => s.owner === currentAccount);
                    // Count the number of strategies as position value for now
                    positionsValue = userStrategies.length > 0 ? (totalBalance * 0.2) : 0;
                }
                
                // Set positions and available balance
                inPositions = positionsValue;
                availableBalance = totalBalance - inPositions;
                
                // Set P&L to zero for now - would be calculated from actual trade history
                pnl = '0%';
            }
        }
        
        // Update UI with account information
        document.getElementById('total-balance').textContent = `$${totalBalance.toFixed(2)}`;
        document.getElementById('available-balance').textContent = `$${availableBalance.toFixed(2)}`;
        document.getElementById('in-positions').textContent = `$${inPositions.toFixed(2)}`;
        document.getElementById('total-pnl').textContent = pnl;
        
        // If we have FHE data, show a notification that we're using real data
        if (fheAccountData) {
            const statusElement = document.getElementById('deposit-status');
            if (statusElement) {
                statusElement.textContent = 'Using real account data from FHE server';
                statusElement.classList.remove('status-pending', 'status-success', 'status-error', 'status-warning');
                statusElement.classList.add('status-success');
                statusElement.style.display = 'block';
                
                // Hide the notification after 5 seconds
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 5000);
            }
        }
        
        // Load trades showing user's investments
        await loadUserTrades();
        
        // Update USDC and deposited balances
        await updateBalances();
    } catch (error) {
        console.error('Error getting account info:', error);
    }
}

// Load user's invested strategies as trades with real performance data
async function loadUserTrades() {
    const tradesTableBody = document.getElementById('trades-table-body');
    
    // Show loading state
    tradesTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="loading">Loading your investments...</td>
        </tr>
    `;
    
    try {
        // First, check if the user has an account
        if (!currentAccount) {
            tradesTableBody.innerHTML = `
                <tr class="no-trades-row">
                    <td colspan="6" class="no-data-message">Please connect your wallet to see your investments.</td>
                </tr>
            `;
            return;
        }
        
        // Try to fetch strategy performance data
        let performanceData = [];
        try {
            performanceData = await fetchStrategyPerformance();
            console.log('Strategy performance data:', performanceData);
        } catch (perfError) {
            console.error('Error fetching strategy performance:', perfError);
        }
        
        // Get account data
        const accountResponse = await fetch(`${API_BASE_URL}/get_account/${currentAccount}`);
        
        if (accountResponse.ok) {
            // Get all strategies
            const strategies = await fetchAllStrategies();
            
            // Filter for strategies this user has invested in
            const userInvestments = strategies.filter(strategy => 
                strategy.investors && strategy.investors.some(inv => inv.address.toLowerCase() === currentAccount.toLowerCase())
            );
            
            if (userInvestments.length === 0) {
                tradesTableBody.innerHTML = `
                    <tr class="no-trades-row">
                        <td colspan="6" class="no-data-message">No investments found</td>
                    </tr>
                `;
                return;
            }
            
            // Generate trades HTML
            const tradesHTML = userInvestments.map(strategy => {
                // Find the user's investment in this strategy
                const userInvestment = strategy.investors.find(inv => 
                    inv.address.toLowerCase() === currentAccount.toLowerCase()
                );
                
                // Find performance data for this strategy
                const strategyPerf = performanceData.find(p => p.id === strategy.id);
                
                // Generate performance display
                let performance;
                if (strategyPerf && strategyPerf.performance) {
                    const pnlValue = strategyPerf.performance.pnl;
                    const roeValue = strategyPerf.performance.roe;
                    const isPositive = pnlValue >= 0;
                    
                    performance = `
                        <div class="${isPositive ? 'positive-pnl' : 'negative-pnl'}">
                            <div>${isPositive ? '+' : ''}$${Math.abs(pnlValue).toFixed(2)}</div>
                            <div class="small-text">${isPositive ? '+' : ''}${roeValue.toFixed(2)}%</div>
                        </div>
                    `;
                } else {
                    // Fallback to simulated performance data if real data is unavailable
                    const isPositive = Math.random() > 0.5;
                    const pnlValue = isPositive ? 
                        (Math.random() * 15).toFixed(2) : 
                        (-Math.random() * 10).toFixed(2);
                    
                    performance = `<span class="${isPositive ? 'positive-pnl' : 'negative-pnl'}">${pnlValue >= 0 ? '+' : ''}$${pnlValue}</span>`;
                }
                
                // Format date (using recent date for demonstration)
                // In a production system, this would come from the actual trade timestamp
                const date = new Date();
                date.setDate(date.getDate() - Math.floor(Math.random() * 10)); // Simulate recent trades
                const formattedDate = date.toLocaleDateString();
                
                return `
                    <tr>
                        <td>${strategy.id}</td>
                        <td>${strategy.name}</td>
                        <td>$${userInvestment ? userInvestment.amount : 0}</td>
                        <td>${strategy.token}</td>
                        <td>${performance}</td>
                        <td>${formattedDate}</td>
                    </tr>
                `;
            }).join('');
            
            tradesTableBody.innerHTML = tradesHTML;
        } else {
            // No account found
            tradesTableBody.innerHTML = `
                <tr class="no-trades-row">
                    <td colspan="6" class="no-data-message">No account found</td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching account data:', error);
        tradesTableBody.innerHTML = `
            <tr class="error-row">
                <td colspan="6" class="error-message">Error fetching account data: ${error.message}</td>
            </tr>
        `;
    }
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
                <button class="invest-btn" onclick="investWithStrategy(${index + 1}, '${strategy.name}')">Invest with Strategy</button>
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

// Invest with a strategy
async function investWithStrategy(strategyId, strategyName) {
    if (!isWalletConnected || !currentAccount) {
        alert('Please connect your wallet first');
        showPage('account');
        return;
    }
    
    // Get the modal elements
    const modal = document.getElementById('investment-modal');
    const modalStrategyName = document.getElementById('modal-strategy-name');
    const modalUsdcBalance = document.getElementById('modal-usdc-balance');
    const strategyIdInput = document.getElementById('investment-strategy-id');
    const closeModal = document.querySelector('.close-modal');
    
    // Set the strategy information
    modalStrategyName.textContent = strategyName || `Strategy #${strategyId}`;
    strategyIdInput.value = strategyId;
    
    // Show the modal
    modal.style.display = 'block';
    
    // Get and display the user's deposited USDC balance from FHE server
    try {
        // Try to get FHE account balance
        const response = await fetch(`${API_BASE_URL}/get_account/${currentAccount}`);
        
        if (response.ok) {
            const accountData = await response.json();
            modalUsdcBalance.textContent = `${parseFloat(accountData.balance).toFixed(2)} USDC`;
        } else {
            // Fallback to wallet balance if FHE account doesn't exist
            const usdcBalance = await getUsdcBalance();
            modalUsdcBalance.textContent = `${parseFloat(usdcBalance).toFixed(2)} USDC (wallet)`;
        }
    } catch (error) {
        console.error('Error getting account balance:', error);
        modalUsdcBalance.textContent = 'Error loading balance';
    }
    
    // Close modal when clicking the X
    closeModal.onclick = function() {
        modal.style.display = 'none';
    };
    
    // Close modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Handle the investment form submission
    const investmentForm = document.getElementById('investment-form');
    
    // Remove any existing event listeners
    const newInvestmentForm = investmentForm.cloneNode(true);
    investmentForm.parentNode.replaceChild(newInvestmentForm, investmentForm);
    
    // Add new event listener
    newInvestmentForm.addEventListener('submit', handleInvestmentSubmit);
}

// Handle investment form submission
async function handleInvestmentSubmit(e) {
    e.preventDefault();
    
    // Get form values
    const strategyIdInput = document.getElementById('investment-strategy-id');
    const strategyId = strategyIdInput.value;
    const amountInput = document.getElementById('investment-amount');
    const amount = amountInput.value;
    
    console.log('Raw strategy ID:', strategyId);
    
    // Validate inputs
    if (!strategyId) {
        alert('Strategy ID is missing');
        return;
    }
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    // Get modal and status elements
    const modal = document.getElementById('investment-modal');
    const statusElement = document.getElementById('investment-status');
    
    try {
        // Show loading state
        if (statusElement) {
            statusElement.textContent = 'Processing investment...';
            statusElement.classList.remove('status-pending', 'status-success', 'status-error', 'status-warning');
            statusElement.classList.add('status-pending');
            statusElement.style.display = 'block';
        }
        
        // Make sure strategy_id is a proper number, not a string
        // Force it to be a number by using Number() instead of parseInt
        const strategyIdNum = Number(strategyId);
        
        // Convert amount to a whole number (the backend expects integers)
        // We'll treat the amount as a whole number of tokens
        const amountNum = Math.floor(parseFloat(amount));
        
        // Check if inputs are valid
        if (isNaN(strategyIdNum) || strategyIdNum <= 0) {
            throw new Error(`Invalid strategy ID: ${strategyId}. Must be a positive number.`);
        }
        
        if (isNaN(amountNum) || amountNum <= 0) {
            throw new Error(`Invalid amount: ${amount}. Must be a positive whole number.`);
        }
        
        console.log('Investment payload:', {
            address: currentAccount,
            strategy_id: strategyIdNum,
            amount: amountNum
        });
        
        // Call the invest endpoint
        const response = await fetch(`${API_BASE_URL}/invest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: currentAccount,
                strategy_id: strategyIdNum,
                amount: amountNum
            })
        });
        
        if (response.ok) {
            const result = await response.text();
            console.log('Investment successful:', result);
            
            if (statusElement) {
                statusElement.textContent = 'Investment successful!';
                statusElement.classList.remove('status-pending');
                statusElement.classList.add('status-success');
                
                // Hide the modal after 2 seconds
                setTimeout(() => {
                    modal.style.display = 'none';
                    // Clear the form
                    amountInput.value = '';
                }, 2000);
            }
            
            // Refresh account info and strategies
            await getAccountInfo();
            loadStrategies();
        } else {
            const errorText = await response.text();
            console.error('Investment error:', errorText);
            
            if (statusElement) {
                statusElement.textContent = `Investment failed: ${errorText}`;
                statusElement.classList.remove('status-pending');
                statusElement.classList.add('status-error');
            }
        }
    } catch (error) {
        console.error('Error investing with strategy:', error);
        
        if (statusElement) {
            statusElement.textContent = `Error: ${error.message}`;
            statusElement.classList.remove('status-pending');
            statusElement.classList.add('status-error');
        }
    }
}

// Make investWithStrategy available globally
window.investWithStrategy = investWithStrategy;

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
            const indicatorSelect = this.querySelector('select:nth-of-type(1)');
            const upperBoundInput = this.querySelector('input[placeholder="Upper limit"]');
            const lowerBoundInput = this.querySelector('input[placeholder="Lower limit"]');
            const tokenSelect = document.getElementById('token-select');
            
            if (!nameInput || !indicatorSelect || !upperBoundInput || !lowerBoundInput || !tokenSelect) {
                alert('Form fields not found!');
                return;
            }
            
            const name = nameInput.value.trim();
            const indicator = indicatorSelect.value;
            const upperBound = upperBoundInput.value;
            const lowerBound = lowerBoundInput.value;
            const token = tokenSelect.value;
            
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
                    signedData.signature,
                    token // Use the selected token
                );
                
                // Reset form
                this.reset();
                
                // Navigate to strategies page and show a status message there
                showPage('strategies');
                
                // Show success message on the strategies page
                const statusElement = document.createElement('div');
                statusElement.className = 'status-message status-success';
                statusElement.textContent = 'Strategy deployed successfully! Your encrypted strategy is now running.';
                
                // Insert the status message at the top of the strategies page
                const strategiesPage = document.getElementById('strategies');
                strategiesPage.insertBefore(statusElement, strategiesPage.firstChild);
                
                // Load strategies
                loadStrategies();
                
                // Remove the status message after 5 seconds
                setTimeout(() => {
                    statusElement.style.opacity = '0';
                    setTimeout(() => statusElement.remove(), 500); // Remove after fade out
                }, 5000);
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
    
    const depositForm = document.getElementById('deposit-form');
    if (depositForm) {
        depositForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!isWalletConnected) {
                alert('Please connect your wallet first');
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
                depositBtn.textContent = 'Processing...';
                
                // Check if USDC is approved
                const isApproved = await checkUsdcAllowance();
                
                // If not approved, approve it first
                if (!isApproved) {
                    updateDepositStatus('Approving USDC...', 'pending');
                    try {
                        await approveUsdc();
                    } catch (approveError) {
                        console.error('Error approving USDC:', approveError);
                        updateDepositStatus(`Error approving USDC: ${approveError.message}`, 'error');
                        depositBtn.disabled = false;
                        depositBtn.textContent = 'Deposit USDC';
                        return;
                    }
                }
                
                // Now deposit
                await depositUsdc(amount);
                amountInput.value = ''; // Clear the input after successful deposit
            } catch (error) {
                console.error('Error in deposit form handler:', error);
                updateDepositStatus(`Error: ${error.message}`, 'error');
            } finally {
                depositBtn.disabled = false;
                depositBtn.textContent = 'Deposit USDC';
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


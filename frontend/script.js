/**
 * Hyper Homo - Frontend JavaScript
 * Handles page navigation, form submissions, and UI interactions
 * Integrates with the FHE server API for encrypted trading strategies
 */

// FHE Server API URL
const API_BASE_URL = 'https://5f2c0532617480427e0633f43274e1d3df471d43-3000.dstack-prod5.phala.network';

// Show the selected page and update navigation
function showPage(pageId) {
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
    event.target.classList.add('active');
    
    // Load data for specific pages
    if (pageId === 'strategies') {
        loadStrategies();
    } else if (pageId === 'account') {
        // In a real app, we would load account data here
    }
}

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
async function createStrategy(name, upperBound, lowerBound, owner) {
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
                owner
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
            strategyCard.innerHTML = `
                <div class="strategy-image">${getStrategyEmoji(index)}</div>
                <div class="strategy-name">${strategy.name}</div>
                <div class="strategy-performance">Owner: ${truncateAddress(strategy.owner)}</div>
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
    // Form submission handlers
    const deployForm = document.getElementById('deployForm');
    if (deployForm) {
        deployForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nameInput = this.querySelector('input[placeholder="Enter strategy name"]');
            const indicatorSelect = this.querySelector('select');
            const upperBoundInput = this.querySelector('input[placeholder="Upper limit"]');
            const lowerBoundInput = this.querySelector('input[placeholder="Lower limit"]');
            
            if (!nameInput || !indicatorSelect || !upperBoundInput || !lowerBoundInput) {
                alert('Form fields not found!');
                return;
            }
            
            const name = nameInput.value;
            const indicator = indicatorSelect.value;
            const upperBound = upperBoundInput.value;
            const lowerBound = lowerBoundInput.value;
            
            // Simple validation
            if (!name || !indicator || !upperBound || !lowerBound) {
                alert('Please fill in all fields!');
                return;
            }
            
            // Use a mock owner address for demo purposes
            const owner = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
            
            // Store submit button reference and original text outside try/catch
            const submitBtn = this.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            
            try {
                // Show loading state
                submitBtn.textContent = 'Creating Strategy...';
                submitBtn.disabled = true;
                
                // Create the strategy
                const result = await createStrategy(
                    `${name} (${indicator})`, 
                    upperBound, 
                    lowerBound, 
                    owner
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
});

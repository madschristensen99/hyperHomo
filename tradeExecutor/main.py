import example_utils
import requests
import json
import time
import logging
import random
from datetime import datetime
from hyperliquid.utils import constants

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("trade_executor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("TradeExecutor")

# FHE Server configuration
FHE_SERVER_URL = "http://localhost:3000"

# Test value for strategy checking
TEST_VALUE = 40

def get_all_strategies():
    """Fetch all strategies from the FHE server"""
    try:
        response = requests.get(f"{FHE_SERVER_URL}/get_all_strategies")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching strategies: {e}")
        return []

def check_strategy(strategy_id, strategy_type, value=TEST_VALUE):
    """Check if a strategy should trigger a trade"""
    endpoint = "/check_long_strategy" if strategy_type == "long" else "/check_short_strategy"
    try:
        payload = {
            "strategy_id": strategy_id,
            "value": value
        }
        logger.info(f"Checking {strategy_type} strategy {strategy_id} with value: {value}")
        response = requests.post(f"{FHE_SERVER_URL}{endpoint}", json=payload)
        response.raise_for_status()
        result = response.text
        logger.info(f"Strategy check result: {result}")
        
        # Check if the result contains 'true' (case-insensitive)
        return "true" in result.lower()
    except Exception as e:
        logger.error(f"Error checking {strategy_type} strategy {strategy_id}: {e}")
        return False

def execute_trade(exchange, strategy, is_long):
    """Execute a trade based on the strategy"""
    try:
        # Extract strategy details
        strategy_id = strategy.get("id", "unknown")
        asset = strategy.get("token", "ETH")
        size = 0.01  # Default small size
        owner_address = strategy.get("owner", None)
        
        # Determine if it's a buy or sell based on strategy type
        is_buy = is_long
        
        logger.info(f"Executing {'long' if is_long else 'short'} trade for strategy {strategy_id} on {asset}, size: {size}")
        
        # Set up builder fee to go to the strategy creator
        builder_config = None
        if owner_address:
            logger.info(f"Setting builder fee to go to strategy creator: {owner_address}")
            builder_config = {"b": owner_address, "f": 1}  # f=1 is 0.001% fee
        
        # Execute the market order with builder fee going to strategy creator
        order_result = exchange.market_open(
            asset, is_buy, size, None, None, 
            builder=builder_config
        )
        
        logger.info(f"Trade executed for strategy {strategy_id}. Result: {order_result}")
        return order_result
    except Exception as e:
        logger.error(f"Error executing trade for strategy: {e}")
        return None

def check_and_execute_strategies():
    """Check all strategies and execute trades if conditions are met"""
    logger.info("Starting strategy check and execution")
    
    # Get all strategies
    strategies = get_all_strategies()
    logger.info(f"Found {len(strategies)} strategies")
    
    # Log all strategies for debugging
    for i, strategy in enumerate(strategies):
        logger.info(f"Strategy {i+1}: {json.dumps(strategy)}")
    
    # Setup exchange connection
    try:
        address, info, exchange = example_utils.setup(constants.TESTNET_API_URL, skip_ws=True)
        logger.info(f"Connected to exchange with account: {address}")
    except Exception as e:
        logger.error(f"Failed to setup exchange connection: {e}")
        return
    
    # Iterate over strategies
    for i, strategy in enumerate(strategies):
        # Use index+1 as a fallback ID if none exists
        strategy_id = strategy.get("id", i+1)
        strategy_name = strategy.get("name", f"Strategy {strategy_id}")
        investors = strategy.get("investors", [])
        is_open = strategy.get("is_open", False)
        token = strategy.get("token", "ETH")
        
        logger.info(f"Evaluating strategy {strategy_id} ({strategy_name}): token={token}, investors={len(investors)}, is_open={is_open}")
        
        # Check if strategy has investors
        if len(investors) > 0:
            # If the strategy is already open, we don't need to check it again
            if is_open:
                logger.info(f"Strategy {strategy_id} is already open, skipping checks")
                continue
                
            logger.info(f"Processing strategy {strategy_id} with {len(investors)} investors")
            
            # Generate a new random test value for long strategy check (between 20 and 80)
            long_test_value = random.randint(20, 80)
            logger.info(f"Using random test value for long strategy check: {long_test_value}")
            
            # Check long strategy with random test value
            long_result = check_strategy(strategy_id, "long", long_test_value)
            if long_result:
                logger.info(f"Long strategy {strategy_id} triggered!")
                execute_trade(exchange, strategy, True)
            else:
                logger.info(f"Long strategy {strategy_id} not triggered")
            
            # Generate a new random test value for short strategy check (between 20 and 80)
            short_test_value = random.randint(20, 80)
            logger.info(f"Using random test value for short strategy check: {short_test_value}")
            
            # Check short strategy with random test value
            short_result = check_strategy(strategy_id, "short", short_test_value)
            if short_result:
                logger.info(f"Short strategy {strategy_id} triggered!")
                execute_trade(exchange, strategy, False)
            else:
                logger.info(f"Short strategy {strategy_id} not triggered")
        else:
            logger.info(f"Skipping strategy {strategy_id}: has_investors={len(investors)>0}, is_open={is_open}")

# Time between checks in seconds
CHECK_INTERVAL = 5

def main():
    # Run the initial setup
    logger.info("Running initial setup")
    address, info, exchange = example_utils.setup(constants.TESTNET_API_URL, skip_ws=True)

    if exchange.account_address != exchange.wallet.address:
        raise Exception("Only the main wallet has permission to approve a builder fee")

    # Log the connected account
    logger.info(f"Connected to exchange with account: {address}")
    
    # Approve setting a builder fee - this is required before any trades can use builder fees
    approve_result = exchange.approve_builder_fee("0xcE716032dFe9d5BB840568171F541A6A046bBf90", "0.001%")
    logger.info(f"Builder fee approval result: {approve_result}")
    
    # Each trade will set the builder fee to go to the strategy creator

    # Run strategy checking in a continuous loop
    logger.info(f"Starting continuous monitoring every {CHECK_INTERVAL} seconds")
    try:
        while True:
            logger.info("------- Checking strategies -------")
            check_and_execute_strategies()
            logger.info(f"Sleeping for {CHECK_INTERVAL} seconds...")
            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        logger.info("Monitoring stopped by user")
        return
    except Exception as e:
        logger.error(f"Error in monitoring loop: {e}")
        return

if __name__ == "__main__":
    main()
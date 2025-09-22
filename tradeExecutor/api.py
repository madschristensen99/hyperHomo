import json
from flask import Flask, jsonify, request
from flask_cors import CORS
import example_utils
from hyperliquid.utils import constants
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("PnL_API")

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/api/pnl', methods=['GET'])
def get_pnl():
    """Get PnL data for the account"""
    try:
        # Setup connection to Hyperliquid
        address, info, exchange = example_utils.setup(constants.TESTNET_API_URL, skip_ws=True)
        logger.info(f"Connected to exchange with account: {address}")
        
        # Get user state using the correct method
        user_state = exchange.get_user_state_by_address(address)
        
        # Process the data
        result = {
            "account_summary": {
                "account_value": float(user_state.get("marginSummary", {}).get("accountValue", 0)),
                "total_margin_used": float(user_state.get("marginSummary", {}).get("totalMarginUsed", 0)),
                "available_margin": float(user_state.get("marginSummary", {}).get("accountValue", 0)) - float(user_state.get("marginSummary", {}).get("totalMarginUsed", 0)),
                "withdrawable": float(user_state.get("withdrawable", 0))
            },
            "positions": []
        }
        
        # Process positions
        asset_positions = user_state.get("assetPositions", [])
        for asset_pos in asset_positions:
            if asset_pos.get("type") == "oneWay" and "position" in asset_pos:
                position = asset_pos["position"]
                coin = position.get("coin", "")
                size = float(position.get("szi", 0))
                direction = "LONG" if size > 0 else "SHORT"
                entry_price = float(position.get("entryPx", 0))
                position_value = float(position.get("positionValue", 0))
                unrealized_pnl = float(position.get("unrealizedPnl", 0))
                roe = float(position.get("returnOnEquity", 0)) * 100  # Convert to percentage
                leverage = position.get("leverage", {}).get("value", 0)
                
                pos_data = {
                    "coin": coin,
                    "direction": direction,
                    "size": abs(size),
                    "entry_price": entry_price,
                    "position_value": position_value,
                    "unrealized_pnl": unrealized_pnl,
                    "roe": roe,
                    "leverage": leverage
                }
                result["positions"].append(pos_data)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting PnL data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/strategies/performance', methods=['GET'])
def get_strategies_performance():
    """Get performance data for strategies"""
    try:
        # This is a mock implementation - in a real system, you would:
        # 1. Get the list of strategies from the FHE server
        # 2. For each strategy, get its performance data from Hyperliquid
        # 3. Return the combined data
        
        # Mock data for demonstration
        strategies = [
            {
                "id": "1",
                "name": "ETH Long Strategy",
                "token": "ETH",
                "type": "long",
                "performance": {
                    "pnl": -8.56,
                    "roe": -76.67,
                    "trades": 3,
                    "win_rate": 33.33
                }
            },
            {
                "id": "2",
                "name": "BTC Short Strategy",
                "token": "BTC",
                "type": "short",
                "performance": {
                    "pnl": 12.45,
                    "roe": 24.9,
                    "trades": 5,
                    "win_rate": 80.0
                }
            }
        ]
        
        return jsonify(strategies)
    except Exception as e:
        logger.error(f"Error getting strategy performance: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

import example_utils
from hyperliquid.info import Info
from hyperliquid.utils import constants
import json

# Initialize the Info client
info = Info(constants.TESTNET_API_URL, skip_ws=True)

# Get user state for a specific address
user_address = "0xf6fe61c7b88ef0688b1b0a141d12e9b98dfe1cc4"
user_state = info.user_state(user_address)

# Print the full user state
print("Full user state:")
print(json.dumps(user_state, indent=2))

# Function to get PnL for a specific asset
def get_asset_pnl(user_state, asset_name):
    if 'assetPositions' in user_state:
        for position in user_state['assetPositions']:
            if position['type'] == 'oneWay' and 'position' in position:
                pos_data = position['position']
                if pos_data.get('coin') == asset_name:
                    return {
                        'asset': asset_name,
                        'size': float(pos_data.get('szi', '0')),
                        'entry_price': float(pos_data.get('entryPx', '0')),
                        'position_value': float(pos_data.get('positionValue', '0')),
                        'unrealized_pnl': float(pos_data.get('unrealizedPnl', '0')),
                        'return_on_equity': float(pos_data.get('returnOnEquity', '0')),
                        'leverage': pos_data.get('leverage', {}).get('value', 1),
                        'is_long': float(pos_data.get('szi', '0')) > 0
                    }
    return None

# Extract PnL information for specific assets
assets_to_check = ['ETH', 'BTC', 'SOL']
for asset in assets_to_check:
    pnl_data = get_asset_pnl(user_state, asset)
    if pnl_data:
        print(f"\n{asset} Position:")
        print(f"Direction: {'LONG' if pnl_data['is_long'] else 'SHORT'}")
        print(f"Size: {pnl_data['size']}")
        print(f"Entry Price: ${pnl_data['entry_price']}")
        print(f"Position Value: ${pnl_data['position_value']}")
        print(f"Unrealized PnL: ${pnl_data['unrealized_pnl']}")
        print(f"Return on Equity: {pnl_data['return_on_equity'] * 100:.2f}%")
        print(f"Leverage: {pnl_data['leverage']}x")
    else:
        print(f"\nNo {asset} position found")

# Check account summary
if 'crossMarginSummary' in user_state:
    summary = user_state['crossMarginSummary']
    account_value = float(summary.get('accountValue', '0'))
    total_margin_used = float(summary.get('totalMarginUsed', '0'))
    
    print("\nAccount Summary:")
    print(f"Account Value: ${account_value}")
    print(f"Total Margin Used: ${total_margin_used}")
    print(f"Available Margin: ${account_value - total_margin_used}")
    
    if 'withdrawable' in user_state:
        print(f"Withdrawable: ${float(user_state['withdrawable'])}")


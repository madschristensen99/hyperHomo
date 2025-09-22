"""
ATR (Average True Range) Trading Strategy
Volatility-based strategy using ATR for position sizing and stop-loss management
"""

from typing import List, Dict, Any, Optional
from .base_strategy import BaseStrategy, TradingSignal

class ATRStrategy(BaseStrategy):
    """ATR-based volatility and risk management strategy"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            'period': 14,           # ATR calculation period
            'atr_multiplier': 2.0,  # Multiplier for stop-loss calculations  
            'risk_percentage': 0.02, # Maximum risk per trade (2%)
            'breakout_threshold': 1.5, # ATR multiplier for breakout signals
            'trend_filter': True    # Use ATR to confirm trends
        }
    
    def get_signal_type(self) -> str:
        return "volatility"
    
    def calculate_atr(self, prices: List[float], period: int = 14) -> float:
        """Calculate Average True Range"""
        if len(prices) < period + 1:
            return 0.0
        
        true_ranges = []
        
        for i in range(1, len(prices)):
            current_high = max(prices[i], prices[i-1])
            current_low = min(prices[i], prices[i-1])
            
            # True range calculation
            true_range = current_high - current_low
            true_ranges.append(abs(true_range))
        
        # Calculate ATR as average of true ranges
        if len(true_ranges) >= period:
            recent_ranges = true_ranges[-period:]
            atr = sum(recent_ranges) / len(recent_ranges)
            return atr
        
        return 0.0
    
    def calculate_support_resistance(self, prices: List[float], current_atr: float) -> Dict[str, float]:
        """Calculate support and resistance levels using ATR"""
        if not prices or current_atr <= 0:
            return {'support': 0.0, 'resistance': 0.0}
        
        current_price = prices[-1]
        
        # Use ATR to create dynamic support/resistance levels
        atr_distance = current_atr * self.params['atr_multiplier']
        
        support = current_price - atr_distance
        resistance = current_price + atr_distance
        
        return {
            'support': max(support, 0.0),
            'resistance': resistance,
            'atr_distance': atr_distance,
            'atr_percentage': (atr_distance / current_price) * 100 if current_price > 0 else 0.0
        }
    
    def analyze(self, price_data: List[float], current_price: float, 
                volume_data: Optional[List[float]] = None) -> TradingSignal:
        """Analyze market using ATR strategy"""
        if not self.validate_data(price_data, min_periods=self.params['period'] + 2):
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Insufficient data for ATR calculation"
            )
        
        # Calculate ATR and related metrics
        atr = self.calculate_atr(price_data, self.params['period'])
        if atr <= 0:
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Cannot calculate valid ATR from data"
            )
        
        # Calculate support/resistance levels
        levels = self.calculate_support_resistance(price_data, atr)
        
        # Use recent price movement for momentum
        recent_prices = price_data[-5:]  # Last 5 periods for momentum
        price_change = ((current_price - recent_prices[0]) / recent_prices[0]) * 100 if recent_prices[0] > 0 else 0.0
        
        # Calculate volatility-based indicators
        volatility_percentage = (atr / current_price) * 100 if current_price > 0 else 0.0
        
        # Determine signal based on ATR and price action
        signal_type = "HOLD"
        confidence = 0.0
        reason = "Neutral market conditions"
        
        # ATR breakout signals
        breakout_distance = atr * self.params['breakout_threshold']
        
        # Strong upward movement (buy signal)
        if price_change > breakout_distance:
            signal_type = "BUY"
            confidence = min(price_change / (volatility_percentage + 0.01), 1.0)
            reason = f"Strong upward momentum: {price_change:.1f}% vs ATR breakout: {breakout_distance:.1f}%"
        
        # Strong downward movement (sell signal)
        elif price_change < -breakout_distance:
            signal_type = "SELL"
            confidence = min(-price_change / (volatility_percentage + 0.01), 1.0)
            reason = f"Strong downward momentum: {price_change:.1f}% vs ATR breakout: {breakout_distance:.1f}%"
        
        # ATR expansion/contraction signals
        elif volatility_percentage > self.params['risk_percentage'] * 100:
            # High volatility - potential for continuation
            if price_change > 0:
                signal_type = "BUY"
                confidence = min(price_change / volatility_percentage, 0.7)
                reason = f"High volatility continuation: ATR={volatility_percentage:.1f}%"
            else:
                signal_type = "SELL"
                confidence = min(-price_change / volatility_percentage, 0.7)
                reason = f"High volatility continuation: ATR={volatility_percentage:.1f}%"
        
        # Support/resistance testing
        else:
            # Price testing support/resistance levels
            distance_to_support = abs(current_price - levels['support'])
            distance_to_resistance = abs(current_price - levels['resistance'])
            
            if distance_to_support < atr and price_change > 0:
                signal_type = "BUY"
                confidence = min(abs(price_change) / volatility_percentage, 0.5)
                reason = f"Price testing support at {levels['support']:.2f} with slight upward bias"
                
            elif distance_to_resistance < atr and price_change < 0:
                signal_type = "SELL"
                confidence = min(abs(price_change) / volatility_percentage, 0.5)
                reason = f"Price testing resistance at {levels['resistance']:.2f} with slight downward bias"
        
        return TradingSignal(
            signal_type=signal_type,
            confidence=confidence,
            reason=reason,
            metadata={
                'atr': atr,
                'current_price': current_price,
                'volatility_percentage': volatility_percentage,
                'price_change_percent': price_change,
                'support': levels['support'],
                'resistance': levels['resistance'],
                'risk_per_trade': self.params['risk_percentage']
            }
        )
    
    def calculate_position_size(self, atr: float, current_price: float, account_balance: float) -> float:
        """Calculate optimal position size based on ATR"""
        if current_price <= 0 or atr <= 0 or account_balance <= 0:
            return 0.0
        
        # Risk per trade
        risk_amount = account_balance * self.params['risk_percentage']
        
        # Position size = Risk amount / (ATR * multiplier)
        stop_loss_distance = atr * self.params['atr_multiplier']
        position_size = risk_amount / stop_loss_distance if stop_loss_distance > 0 else 0.0
        
        # Cap position size at 95% of account balance
        max_position = (account_balance / current_price) * 0.95
        return min(position_size, max_position)
    
    def get_atr_metrics(self) -> Dict[str, float]:
        """Get ATR parameter levels"""
        return {
            'period': self.params['period'],
            'atr_multiplier': self.params['atr_multiplier'],
            'risk_percentage': self.params['risk_percentage'] * 100,
            'breakout_threshold': self.params['breakout_threshold'],
            'trend_filter_enabled': self.params['trend_filter']
        }
    
    def explain_parameters(self) -> str:
        """Explain the strategy parameters"""
        return f"""
        ATR Strategy Parameters:
        - Period: {self.params['period']} days for ATR calculation
        - ATR Multiplier: {self.params['atr_multiplier']}x (stop-loss sizing)
        - Risk Percentage: {self.params['risk_percentage']*100}% per trade
        - Breakout Threshold: {self.params['breakout_threshold']} ATR levels
        - Trend Filter: {self.params['trend_filter']} (confirm signals with trend)
        - Token: {self.token}
        
        Risk Management:
        - ATR defines stop-loss distances
        - Position sizing based on volatility
        - Maximum risk per trade enforced
        
        Signals:
        - BUY: Price breaking resistance with trend confirmation
        - SELL: Price breaking support with trend confirmation
        - HOLD: Range-bound or conflicting signals
        """

# Example ATR configurations
ATR_CONFIGS = {
    'conservative': {
        'period': 21,
        'atr_multiplier': 1.5,
        'risk_percentage': 0.015,
        'breakout_threshold': 1.2,
        'trend_filter': True
    },
    'moderate': {
        'period': 14,
        'atr_multiplier': 2.0,
        'risk_percentage': 0.02,
        'breakout_threshold': 1.5,
        'trend_filter': True
    },
    'aggressive': {
        'period': 10,
        'atr_multiplier': 2.5,
        'risk_percentage': 0.03,
        'breakout_threshold': 2.0,
        'trend_filter': False
    }
}
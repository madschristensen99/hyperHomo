"""
Exponential Moving Average (EMA) Trading Strategy
More responsive moving average using exponential weighting
"""

from typing import List, Dict, Any, Optional
from .base_strategy import BaseStrategy, TradingSignal

class EMAStrategy(BaseStrategy):
    """Exponential Moving Average trend-following strategy"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            'period': 12,
            'multiplier': 0.15,  # More responsive than simple averages
            'comparison_period': 26,  # For EMA crossover approach
            'buffer_percentage': 0.01,
            'alpha_factor': 1.0  # Additional responsiveness factor
        }
    
    def get_signal_type(self) -> str:
        return "trend"
    
    def calculate_ema(self, prices: List[float], period: int) -> float:
        """Calculate Exponential Moving Average (returns latest value)"""
        if not prices or period <= 0:
            return prices[-1] if prices else 0.0
        
        alpha = 2 / (period + 1)
        adjusted_alpha = min(alpha * self.params['alpha_factor'], 1.0)
        
        ema = prices[0]
        for price in prices[1:][-period:]:  # Use only recent values
            ema = (price * adjusted_alpha) + ema * (1 - adjusted_alpha)
        
        return ema
    
    def calculate_weighted_price_trend(self, prices: List[float]) -> Dict[str, float]:
        """Use EMA to calculate trend direction and strength"""
        if len(prices) < max(self.params['period'], self.params['comparison_period']):
            return {'trend': 0.0, 'momentum': 0.0, 'support': 0.0, 'resistance': 0.0}
        
        # Calculate EMAs for different periods
        short_ema = self.calculate_ema(prices, self.params['period'])
        long_ema = self.calculate_ema(prices, self.params['comparison_period'])
        
        # Price relative to EMAs
        current_price = prices[-1] if prices else 0.0
        
        # Calculate momentum based on EMA relationships
        trend_strength = (short_ema - long_ema) / long_ema if long_ema > 0 else 0.0
        price_momentum = (current_price - short_ema) / current_price if current_price > 0 else 0.0
        
        # Support/resistance levels based on EMAs
        support = long_ema * (1 - self.params['buffer_percentage'])
        resistance = short_ema * (1 + self.params['buffer_percentage'])
        
        return {
            'trend': trend_strength,
            'momentum': price_momentum,
            'support': support,
            'resistance': resistance,
            'short_ema': short_ema,
            'long_ema': long_ema,
            'current_price': current_price
        }
    
    def analyze(self, price_data: List[float], current_price: float, 
                volume_data: Optional[List[float]] = None) -> TradingSignal:
        """Analyze market using EMA strategy"""
        if not self.validate_data(price_data, min_periods=max(self.params['period'], self.params['comparison_period'])):
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Insufficient data for EMA calculation"
            )
        
        # Calculate EMA indicators
        ema_data = self.calculate_weighted_price_trend(price_data)
        
        trend_strength = ema_data['trend']
        price_momentum = ema_data['momentum']
        
        # Signal determination based on EMA relationships
        signal_type = "HOLD"
        confidence = 0.0
        reason = "Neutral market conditions"
        
        # Strong bull trend with price above EMAs
        if trend_strength > 0.01 and price_momentum > 0:
            signal_type = "BUY"
            confidence = min(abs(trend_strength) * 25 + abs(price_momentum) * 50, 1.0)
            reason = f"Bullish EMA crossover: Short={ema_data['short_ema']:.2f}, Long={ema_data['long_ema']:.2f}, Trend={trend_strength*100:.1f}%"
        
        # Strong bear trend with price below EMAs
        elif trend_strength < -0.01 and price_momentum < 0:
            signal_type = "SELL"
            confidence = min(abs(trend_strength) * 25 + abs(price_momentum) * 50, 1.0)
            reason = f"Bearish EMA crossover: Short={ema_data['short_ema']:.2f}, Long={ema_data['long_ema']:.2f}, Trend={trend_strength*100:.1f}%"
        
        # EMA support/resistance bounce
        elif abs(current_price - ema_data['long_ema']) / current_price < 0.005:
            # Price near long EMA - potential bounce
            if ema_data['trend'] > 0:
                signal_type = "BUY"
                confidence = 0.4
                reason = f"Price bouncing from EMA support: ${current_price:.2f}"
            else:
                signal_type = "SELL"
                confidence = 0.4
                reason = f"Price testing EMA resistance: ${current_price:.2f}"
        
        # Momentum continuation
        else:
            if ema_data['trend'] > 0 and current_price > ema_data['short_ema']:
                signal_type = "HOLD"
                confidence = 0.3
                reason = f"Trend continuation: ${current_price:.2f} above EMAs"
            elif ema_data['trend'] < 0 and current_price < ema_data['short_ema']:
                signal_type = "HOLD"
                confidence = 0.3
                reason = f"Trend continuation: ${current_price:.2f} below EMAs"
        
        return TradingSignal(
            signal_type=signal_type,
            confidence=confidence,
            reason=reason,
            metadata={
                **ema_data,
                'trend_strength_percent': trend_strength * 100,
                'momentum_percent': price_momentum * 100
            }
        )
    
    def get_ema_levels(self) -> Dict[str, int]:
        """Get EMA parameter levels"""
        return {
            'short_period': self.params['period'],
            'long_period': self.params['comparison_period'],
            'buffer_percentage': int(self.params['buffer_percentage'] * 100)
        }
    
    def explain_parameters(self) -> str:
        """Explain the strategy parameters"""
        return f"""
        EMA Strategy Parameters:
        - Short EMA Period: {self.params['period']} days
        - Long EMA Period: {self.params['comparison_period']} days
        - Buffer: {self.params['buffer_percentage']*100}% support/resistance zone
        - Alpha Factor: {self.params['alpha_factor']} (responsiveness multiplier)
        - Token: {self.token}
        
        EMA Logic:
        - More responsive than SMA due to exponential weighting
        - Weighted average gives more importance to recent prices
        - Crossover signals identify trend changes
        - Support/resistance levels adapt rapidly to market changes
        
        Signals:
        - BUY: Price above EMAs with positive trend confirmation
        - SELL: Price below EMAs with negative trend confirmation
        - HOLD: Neutral zone or trend uncertainty
        """

# Example EMA configurations
EMA_CONFIGS = {
    'short_term': {
        'period': 8,
        'comparison_period': 21,
        'buffer_percentage': 0.008,
        'alpha_factor': 1.2
    },
    'medium_term': {
        'period': 12,
        'comparison_period': 26,
        'buffer_percentage': 0.012,
        'alpha_factor': 1.0
    },
    'long_term': {
        'period': 21,
        'comparison_period': 50,
        'buffer_percentage': 0.015,
        'alpha_factor': 0.8
    }
}
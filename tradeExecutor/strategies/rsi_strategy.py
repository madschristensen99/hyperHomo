"""
RSI (Relative Strength Index) Trading Strategy
Implements RSI-based momentum indicators for trading signals
"""

from typing import List, Dict, Any, Optional
from .base_strategy import BaseStrategy, TradingSignal

class RSIStrategy(BaseStrategy):
    """RSI-based momentum trading strategy"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            'period': 14,
            'overbought': 70,
            'oversold': 30,
            'neutral_zone_high': 60,
            'neutral_zone_low': 40,
            'confirmation_bars': 1,  # Confirm signals across bars
        }
    
    def get_signal_type(self) -> str:
        return "momentum"
    
    def calculate_rsi(self, prices: List[float]) -> float:
        """Calculate RSI for given price data"""
        if len(prices) < self.params['period'] + 1:
            return 50.0  # Neutral RSI if insufficient data
        
        gains = []
        losses = []
        
        for i in range(1, len(prices)):
            change = prices[i] - prices[i-1]
            gains.append(max(change, 0))
            losses.append(max(-change, 0))
        
        # Calculate initial average gain/loss
        period = self.params['period']
        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period
        
        # Calculate RSI using smoothing
        for i in range(period, len(gains)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def analyze(self, price_data: List[float], current_price: float, 
                volume_data: Optional[List[float]] = None) -> TradingSignal:
        """Analyze market using RSI"""
        if not self.validate_data(price_data, min_periods=self.params['period'] + 1):
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Insufficient data for RSI calculation"
            )
        
        # Calculate RSI
        rsi = self.calculate_rsi(price_data)
        
        # Determine signal based on RSI levels
        if rsi >= self.params['overbought']:
            # Overbought - potential sell signal
            confidence = min((rsi - self.params['overbought']) / 30, 1.0)
            reason = f"RSI overbought at {rsi:.2f} (>= {self.params['overbought']})"
            return TradingSignal(
                signal_type="SELL",
                confidence=confidence,
                reason=reason,
                metadata={"rsi": rsi, "level": "overbought"}
            )
        
        elif rsi <= self.params['oversold']:
            # Oversold - potential buy signal
            confidence = min((self.params['oversold'] - rsi) / 30, 1.0)
            reason = f"RSI oversold at {rsi:.2f} (<= {self.params['oversold']})"
            return TradingSignal(
                signal_type="BUY",
                confidence=confidence,
                reason=reason,
                metadata={"rsi": rsi, "level": "oversold"}
            )
        
        else:
            # Neutral zone or continuation zone
            if rsi > self.params['neutral_zone_high'] and rsi < self.params['overbought']:
                # Moderately overbought, but not extreme
                return TradingSignal(
                    signal_type="HOLD",
                    confidence=0.3,
                    reason=f"RSI in moderate overbought zone: {rsi:.2f}",
                    metadata={"rsi": rsi, "level": "moderate_overbought"}
                )
            
            elif rsi < self.params['neutral_zone_low'] and rsi > self.params['oversold']:
                # Moderately oversold, but not extreme
                return TradingSignal(
                    signal_type="HOLD",
                    confidence=0.3,
                    reason=f"RSI in moderate oversold zone: {rsi:.2f}",
                    metadata={"rsi": rsi, "level": "moderate_oversold"}
                )
            
            else:
                # Neutral zone
                return TradingSignal(
                    signal_type="HOLD",
                    confidence=0.1,
                    reason=f"RSI in neutral zone: {rsi:.2f}",
                    metadata={"rsi": rsi, "level": "neutral"}
                )
    
    def get_rsi_levels(self) -> Dict[str, float]:
        """Get RSI threshold levels"""
        return {
            'oversold': self.params['oversold'],
            'overbought': self.params['overbought'],
            'neutral_low': self.params['neutral_zone_low'],
            'neutral_high': self.params['neutral_zone_high']
        }
    
    def explain_parameters(self) -> str:
        """Explain the strategy parameters"""
        return f"""
        RSI Strategy Parameters:
        - Period: {self.params['period']} days for RSI calculation
        - Overbought: {self.params['overbought']} (RSI level for sell signals)
        - Oversold: {self.params['oversold']} (RSI level for buy signals)
        - Neutral Zone: {self.params['neutral_zone_low']}-{self.params['neutral_zone_high']}
        - Token: {self.token}
        """

# Example usage and parameter configurations
RSI_CONFIGS = {
    'conservative': {
        'period': 14,
        'overbought': 75,
        'oversold': 25,
        'neutral_zone_high': 60,
        'neutral_zone_low': 40
    },
    'aggressive': {
        'period': 9,
        'overbought': 65,
        'oversold': 35,
        'neutral_zone_high': 55,
        'neutral_zone_low': 45
    },
    'long_term': {
        'period': 21,
        'overbought': 70,
        'oversold': 30,
        'neutral_zone_high': 60,
        'neutral_zone_low': 40
    }
}
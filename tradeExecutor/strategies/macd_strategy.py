"""
MACD (Moving Average Convergence Divergence) Trading Strategy
Implements trend-following based on MACD line and signal crossovers
"""

from typing import List, Dict, Any, Optional
from .base_strategy import BaseStrategy, TradingSignal

class MACDStrategy(BaseStrategy):
    """MACD-based trend-following strategy"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            'fast_period': 12,
            'slow_period': 26,
            'signal_period': 9,
            'histogram_threshold': 0.01,
            'confirm_trend': True,  # Wait for multiple confirmations
            'use_histogram': True
        }
    
    def get_signal_type(self) -> str:
        return "trend"
    
    def calculate_ema(self, prices: List[float], period: int) -> List[float]:
        """Calculate Exponential Moving Average"""
        if len(prices) < period:
            return [prices[-1] if prices else 0.0]
        
        multiplier = 2 / (period + 1)
        ema_values = [sum(prices[:period]) / period]  # Start with SMA for first value
        
        for i in range(period, len(prices)):
            current_ema = (prices[i] * multiplier) + (ema_values[-1] * (1 - multiplier))
            ema_values.append(current_ema)
        
        return ema_values
    
    def calculate_macd(self, prices: List[float]) -> Dict[str, float]:
        """Calculate MACD line, signal line, and histogram"""
        if len(prices) < self.params['slow_period']:
            return {'macd': 0.0, 'signal': 0.0, 'histogram': 0.0}
        
        # Calculate EMAs
        ema_fast = self.calculate_ema(prices, self.params['fast_period'])
        ema_slow = self.calculate_ema(prices, self.params['slow_period'])
        
        # Ensure we align periods correctly
        min_len = min(len(ema_fast), len(ema_slow))
        if min_len < 1:
            return {'macd': 0.0, 'signal': 0.0, 'histogram': 0.0}
        
        # MACD line = EMA12 - EMA26 (using last values)
        start_idx = len(ema_fast) - min_len
        fast_values = ema_fast[-min_len:]
        slow_values = ema_slow[-min_len:]
        
        macd_line = [fast - slow for fast, slow in zip(fast_values, slow_values)]
        
        # Signal line = EMA9 of MACD line
        signal_line = self.calculate_ema(macd_line, self.params['signal_period'])
        
        # Histogram = MACD line - Signal line
        last_macd = macd_line[-1] if macd_line else 0.0
        last_signal = signal_line[-1] if signal_line else 0.0
        
        return {
            'macd': last_macd,
            'signal': last_signal,
            'histogram': last_macd - last_signal
        }
    
    def analyze(self, price_data: List[float], current_price: float, 
                volume_data: Optional[List[float]] = None) -> TradingSignal:
        """Analyze market using MACD"""
        if not self.validate_data(price_data, min_periods=self.params['slow_period']):
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Insufficient data for MACD calculation"
            )
        
        # Calculate MACD
        macd_data = self.calculate_macd(price_data)
        macd_line = macd_data['macd']
        signal_line = macd_data['signal']
        histogram = macd_data['histogram']
        
        # Determine signal based on crossovers
        signal_type = "HOLD"
        confidence = 0.0
        reason = "Waiting for clear signal"
        
        # MACD line crossing above signal line (bullish crossover)
        if macd_line > signal_line and abs(histogram) > self.params['histogram_threshold']:
            # Check if it's a significant crossover
            hist_ratio = abs(histogram) / max(abs(macd_line), abs(signal_line), 0.001)
            confidence = min(hist_ratio * 2, 1.0)
            
            if histogram > 0:
                signal_type = "BUY"
                reason = f"MACD bullish crossover: MACD={macd_line:.4f}, Signal={signal_line:.4f}"
                confidence *= 0.8  # Reduce confidence slightly for lagging indicator
            else:
                signal_type = "SELL"
                reason = f"MACD bearish crossover: MACD={macd_line:.4f}, Signal={signal_line:.4f}"
                confidence *= 0.8
        
        elif abs(histogram) < self.params['histogram_threshold']:
            # Very close to zero, no clear trend
            signal_type = "HOLD"
            confidence = 0.1
            reason = "MACD near crossover point, waiting for confirmation"
        
        return TradingSignal(
            signal_type=signal_type,
            confidence=confidence,
            reason=reason,
            metadata={
                'macd': macd_line,
                'signal': signal_line,
                'histogram': histogram,
                'current_price': current_price
            }
        )
    
    def get_macd_levels(self) -> Dict[str, Dict[str, int]]:
        """Get MACD parameter levels"""
        return {
            'periods': {
                'fast': self.params['fast_period'],
                'slow': self.params['slow_period'],
                'signal': self.params['signal_period']
            },
            'thresholds': {
                'histogram_threshold': self.params['histogram_threshold']
            }
        }
    
    def explain_parameters(self) -> str:
        """Explain the strategy parameters"""
        return f"""
        MACD Strategy Parameters:
        - Fast Period: {self.params['fast_period']} days (EMA short-term)
        - Slow Period: {self.params['slow_period']} days (EMA long-term)
        - Signal Period: {self.params['signal_period']} days (EMA of MACD line)
        - Histogram Threshold: {self.params['histogram_threshold']} (minimum difference to confirm signal)
        - Token: {self.token}
        
        Signals:
        - BUY: MACD line crosses above Signal line (bullish crossover)
        - SELL: MACD line crosses below Signal line (bearish crossover)
        - HOLD: No clear crossover or insufficient evidence
        """

# Example MACD configurations
MACD_CONFIGS = {
    'standard': {
        'fast_period': 12,
        'slow_period': 26,
        'signal_period': 9,
        'histogram_threshold': 0.001
    },
    'fast': {
        'fast_period': 8,
        'slow_period': 21,
        'signal_period': 5,
        'histogram_threshold': 0.002
    },
    'slow': {
        'fast_period': 19,
        'slow_period': 39,
        'signal_period': 10,
        'histogram_threshold': 0.0005
    }
}
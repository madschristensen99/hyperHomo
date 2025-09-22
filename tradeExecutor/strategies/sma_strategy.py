"""
Simple Moving Average (SMA) Trading Strategy
Basic trend-following using price crosses above/below moving average
"""

from typing import List, Dict, Any, Optional
from .base_strategy import BaseStrategy, TradingSignal

class SMAStrategy(BaseStrategy):
    """Simple Moving Average trend-following strategy"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            'period': 20,
            'buffer_percentage': 0.01,  # Small buffer to avoid whipsaws
            'use_multiple_ma': False,   # Use multiple MAs
            'short_ma_period': 10,      # Short MA period if using multiple
            'long_ma_period': 50         # Long MA period if using multiple
        }
    
    def get_signal_type(self) -> str:
        return "trend"
    
    def calculate_sma(self, prices: List[float], period: int) -> float:
        """Calculate Simple Moving Average"""
        if len(prices) < period:
            return prices[-1] if prices else 0.0
        
        return sum(prices[-period:]) / period
    
    def analyze_single_ma(self, price_data: List[float], current_price: float) -> TradingSignal:
        """Analyze using single moving average"""
        sma = self.calculate_sma(price_data, self.params['period'])
        buffer = sma * self.params['buffer_percentage']
        
        # Check if price is significantly above/below SMA
        if current_price > sma + buffer:
            # Potential buy signal - price above trend
            deviation = (current_price - sma) / sma
            confidence = min(deviation * 2, 1.0)  # Cap at 100%
            
            return TradingSignal(
                signal_type="BUY",
                confidence=confidence,
                reason=f"Price ${current_price:.2f} above SMA {sma:.2f} by {deviation*100:.1f}%",
                metadata={
                    'sma': sma,
                    'price': current_price,
                    'deviation': deviation,
                    'technique': 'single_ma'
                }
            )
            
        elif current_price < sma - buffer:
            # Potential sell signal - price below trend  
            deviation = abs(current_price - sma) / sma
            confidence = min(deviation * 2, 1.0)
            
            return TradingSignal(
                signal_type="SELL",
                confidence=confidence,
                reason=f"Price ${current_price:.2f} below SMA {sma:.2f} by {deviation*100:.1f}%",
                metadata={
                    'sma': sma,
                    'price': current_price,
                    'deviation': deviation,
                    'technique': 'single_ma'
                }
            )
        
        else:
            # Price near SMA - hold
            deviation = abs(current_price - sma) / sma
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.2,  # Low confidence when near MA
                reason=f"Price ${current_price:.2f} close to SMA {sma:.2f} within buffer",
                metadata={
                    'sma': sma,
                    'price': current_price,
                    'deviation': deviation,
                    'technique': 'single_ma'
                }
            )
    
    def analyze_multiple_ma(self, price_data: List[float], current_price: float) -> TradingSignal:
        """Analyze using multiple moving averages"""
        if len(price_data) < self.params['long_ma_period']:
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Insufficient data for multiple MA strategy"
            )
        
        short_ma = self.calculate_sma(price_data, self.params['short_ma_period'])
        long_ma = self.calculate_sma(price_data, self.params['long_ma_period'])
        
        # Golden cross: short MA above long MA
        if short_ma > long_ma and current_price > short_ma:
            strength = (short_ma - long_ma) / long_ma
            confidence = min(strength * 50, 1.0)  # 2% difference = 100% confidence
            
            return TradingSignal(
                signal_type="BUY",
                confidence=confidence,
                reason=f"Golden cross: Short MA ${short_ma:.2f} above Long MA ${long_ma:.2f}",
                metadata={
                    'short_ma': short_ma,
                    'long_ma': long_ma,
                    'current_price': current_price,
                    'strength': strength,
                    'technique': 'golden_cross'
                }
            )
            
        # Death cross: short MA below long MA  
        elif short_ma < long_ma and current_price < short_ma:
            strength = abs(short_ma - long_ma) / long_ma
            confidence = min(strength * 50, 1.0)
            
            return TradingSignal(
                signal_type="SELL",
                confidence=confidence,
                reason=f"Death cross: Short MA ${short_ma:.2f} below Long MA ${long_ma:.2f}",
                metadata={
                    'short_ma': short_ma,
                    'long_ma': long_ma,
                    'current_price': current_price,
                    'strength': strength,
                    'technique': 'death_cross'
                }
            )
        
        else:
            # No clear trend
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.3,
                reason=f"MAs showing mixed signals - Short: ${short_ma:.2f}, Long: ${long_ma:.2f}",
                metadata={
                    'short_ma': short_ma,
                    'long_ma': long_ma,
                    'current_price': current_price,
                    'technique': 'mixed_signals'
                }
            )
    
    def analyze(self, price_data: List[float], current_price: float, 
                volume_data: Optional[List[float]] = None) -> TradingSignal:
        """Analyze market using SMA strategy"""
        if not self.validate_data(price_data, min_periods=self.params['period']):
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Insufficient data for SMA calculation"
            )
        
        if self.params['use_multiple_ma']:
            min_required = max(self.params['short_ma_period'], self.params['long_ma_period'])
            if len(price_data) < min_required:
                return TradingSignal(
                    signal_type="HOLD",
                    confidence=0.0,
                    reason="Insufficient data for multiple MA strategy"
                )
            return self.analyze_multiple_ma(price_data, current_price)
        else:
            return self.analyze_single_ma(price_data, current_price)
    
    def get_ma_levels(self) -> Dict[str, int]:
        """Get MA parameter levels"""
        if self.params['use_multiple_ma']:
            return {
                'short_ma_period': self.params['short_ma_period'],
                'long_ma_period': self.params['long_ma_period'],
                'buffer_percentage': int(self.params['buffer_percentage'] * 100)
            }
        else:
            return {
                'period': self.params['period'],
                'buffer_percentage': int(self.params['buffer_percentage'] * 100)
            }
    
    def explain_parameters(self) -> str:
        """Explain the strategy parameters"""
        if self.params['use_multiple_ma']:
            return f"""
            SMA Strategy Parameters (Multiple MAs):
            - Short MA Period: {self.params['short_ma_period']} days
            - Long MA Period: {self.params['long_ma_period']} days  
            - Technique: Golden/Death Cross using multiple MAs
            - Token: {self.token}
            
            Signals:
            - BUY: Short MA crosses above Long MA (golden cross)
            - SELL: Short MA crosses below Long MA (death cross)
            - HOLD: No clear crossover pattern
            """
        else:
            return f"""
            SMA Strategy Parameters (Single MA):
            - Period: {self.params['period']} days
            - Buffer: {self.params['buffer_percentage']*100}% tolerance around MA
            - Token: {self.token}
            
            Signals:
            - BUY: Price significantly above MA
            - SELL: Price significantly below MA
            - HOLD: Price within buffer zone
            """

# Example SMA configurations
SMA_CONFIGS = {
    'short': {
        'period': 10,
        'buffer_percentage': 0.015,
        'use_multiple_ma': False
    },
    'medium': {
        'period': 20,
        'buffer_percentage': 0.020,
        'use_multiple_ma': False
    },
    'long': {
        'period': 50,
        'buffer_percentage': 0.025,
        'use_multiple_ma': False
    },
    'golden_death_cross': {
        'short_ma_period': 20,
        'long_ma_period': 50,
        'use_multiple_ma': True
    }
}
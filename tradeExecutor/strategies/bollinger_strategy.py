"""
Bollinger Bands Trading Strategy
Implements volatility-based trading using price bands
"""

from typing import List, Dict, Any, Optional
import numpy as np
from .base_strategy import BaseStrategy, TradingSignal

class BollingerBandsStrategy(BaseStrategy):
    """Bollinger Bands-based volatility strategy"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            'period': 20,  # SMA period
            'std_dev': 2.0,  # Standard deviation multipliers
            'band_width_threshold': 0.02,  # Minimum band width
            'breakout_strength': 0.01,  # How far beyond bands to consider breakout
            'use_squeeze': True  # Trade band squeeze releases
        }
    
    def get_signal_type(self) -> str:
        return "volatility"
    
    def calculate_bollinger_bands(self, prices: List[float]) -> Dict[str, float]:
        """Calculate Bollinger Bands"""
        if len(prices) < self.params['period']:
            current_price = prices[-1] if prices else 0.0
            return {
                'upper': current_price * 1.02,
                'middle': current_price,
                'lower': current_price * 0.98,
                'width': current_price * 0.04,
                'bollinger_divergence': 0.5,
                'sma': current_price
            }
        
        recent_prices = prices[-self.params['period']:]
        
        # Simple Moving Average (middle band)
        sma = sum(recent_prices) / len(recent_prices)
        
        # Standard Deviation
        squared_diffs = [(price - sma) ** 2 for price in recent_prices]
        std_dev = (sum(squared_diffs) / len(recent_prices)) ** 0.5
        
        # Bollinger Bands
        upper_band = sma + (self.params['std_dev'] * std_dev)
        lower_band = sma - (self.params['std_dev'] * std_dev)
        
        return {
            'upper': upper_band,
            'middle': sma,
            'lower': lower_band,
            'width': upper_band - lower_band,
            'std_dev': std_dev,
            'sma': sma
        }
    
    def calculate_bollinger_divergence(self, current_price: float, 
                                     upper_band: float, lower_band: float) -> float:
        """Calculate where price is relative to bands (0-1 scale)"""
        if current_price >= upper_band:
            return 1.0
        elif current_price <= lower_band:
            return 0.0
        else:
            # Normalize price position between bands
            range_val = upper_band - lower_band
            position = (current_price - lower_band) / range_val
            return position
    
    def detect_squeeze(self, band_width: float, prices: List[float]) -> bool:
        """Detect if Bollinger Bands are in a squeeze pattern"""
        if len(prices) < 20:
            return False
        
        recent_widths = []
        for i in range(len(prices) - 19, len(prices)):
            period_prices = prices[max(0, i-19):i+1]
            if len(period_prices) >= self.params['period']:
                bb_data = self.calculate_bollinger_bands(period_prices)
                recent_widths.append(bb_data['width'])
        
        if len(recent_widths) < 6:
            return False
        
        current_width = band_width
        avg_recent_width = sum(recent_widths) / len(recent_widths)
        
        # Squeeze if current width is significantly smaller than recent average
        return current_width < (avg_recent_width * self.params['band_width_threshold'])
    
    def analyze(self, price_data: List[float], current_price: float, 
                volume_data: Optional[List[float]] = None) -> TradingSignal:
        """Analyze market using Bollinger Bands"""
        if not self.validate_data(price_data, min_periods=self.params['period']):
            return TradingSignal(
                signal_type="HOLD",
                confidence=0.0,
                reason="Insufficient data for Bollinger Bands calculation"
            )
        
        # Calculate Bollinger Bands
        bb_data = self.calculate_bollinger_bands(price_data)
        
        # Determine signal based on price relative to bands
        price_position = self.calculate_bollinger_divergence(
            current_price, bb_data['upper'], bb_data['lower']
        )
        
        # Band width for squeeze detection
        band_width = bb_data['width']
        
        # Trading signals based on Bollinger Bands rules
        signal_type = "HOLD"
        confidence = 0.0
        reason = "Price within normal range"
        
        # Upper band breakout - potential sell signal
        if current_price >= bb_data['upper'] * (1 + self.params['breakout_strength']):
            signal_type = "SELL"
            confidence = min((current_price - bb_data['upper']) / bb_data['std_dev'], 1.0)
            reason = f"Strong upper band breakout: Price ${current_price:.2f} vs Upper Band ${bb_data['upper']:.2f}"
        
        # Lower band breakout - potential buy signal  
        elif current_price <= bb_data['lower'] * (1 - self.params['breakout_strength']):
            signal_type = "BUY"
            confidence = min((bb_data['lower'] - current_price) / bb_data['std_dev'], 1.0)
            reason = f"Strong lower band breakout: Price ${current_price:.2f} vs Lower Band ${bb_data['lower']:.2f}"
        
        # Bounce off upper band - moderate sell signal
        elif current_price > bb_data['upper']:
            signal_type = "SELL"
            confidence = 0.6
            reason = f"Price bouncing off upper band: ${current_price:.2f} vs Upper Band ${bb_data['upper']:.2f}"
        
        # Bounce off lower band - moderate buy signal
        elif current_price < bb_data['lower']:
            signal_type = "BUY"
            confidence = 0.6
            reason = f"Price bouncing off lower band: ${current_price:.2f} vs Lower Band ${bb_data['lower']:.2f}"
        
        # Squeeze detection
        elif self.params['use_squeeze'] and self.detect_squeeze(band_width, price_data):
            if price_position > 0.8:  # Near upper end of squeeze
                signal_type = "SELL"
                confidence = 0.4
                reason = f"Band squeeze near resistance: {price_position:.2f}"
            elif price_position < 0.2:  # Near lower end of squeeze
                signal_type = "BUY"
                confidence = 0.4
                reason = f"Band squeeze near support: {price_position:.2f}"
            else:
                signal_type = "HOLD"
                confidence = 0.3
                reason = "Band squeeze pattern detected, awaiting breakout"
        
        # Mid-band crossover
        else:
            if price_position > 0.5:
                if abs(current_price - bb_data['middle']) / bb_data['std_dev'] < 0.5:
                    signal_type = "SELL"
                    confidence = 0.2
                    reason = f"Price approaching from above Middle Band: ${current_price:.2f}"
            else:
                if abs(current_price - bb_data['middle']) / bb_data['std_dev'] < 0.5:
                    signal_type = "BUY"
                    confidence = 0.2
                    reason = f"Price approaching from below Middle Band: ${current_price:.2f}"
        
        return TradingSignal(
            signal_type=signal_type,
            confidence=confidence,
            reason=reason,
            metadata={
                'current_position': price_position,
                'band_width': band_width,
                'std_dev': bb_data['std_dev'],
                'bands': {
                    'upper': bb_data['upper'],
                    'middle': bb_data['middle'],
                    'lower': bb_data['lower']
                },
                'squeeze_detected': self.detect_squeeze(band_width, price_data) if self.params['use_squeeze'] else False
            }
        )
    
    def get_band_levels(self) -> Dict[str, Dict[str, int or float]]:
        """Get Bollinger Bands parameter levels"""
        return {
            'periods': {
                'sma': self.params['period'],  
            },
            'thresholds': {
                'std_dev_multiplier': self.params['std_dev'],
                'band_width_threshold': self.params['band_width_threshold'],
                'breakout_strength': self.params['breakout_strength']
            }
        }
    
    def explain_parameters(self) -> str:
        """Explain the strategy parameters"""
        return f"""
        Bollinger Bands Strategy Parameters:
        - Period: {self.params['period']} days for SMA calculation
        - Standard Deviation Multiplier: {self.params['std_dev']}x
        - Band Width Threshold: {self.params['band_width_threshold']} (squeeze detection)
        - Breakout Strength: {self.params['breakout_strength']} (tolerance beyond bands)
        - Use Squeeze: {self.params['use_squeeze']} (trade band compression patterns)
        - Token: {self.token}
        
        Trading Logic:
        - BUY: Price below lower band or bouncing off lower band
        - SELL: Price above upper band or bouncing off upper band
        - HOLD: Price within bands or no clear pattern
        - Squeeze: Trade compression releases when bands narrow
        """

# Example Bollinger Bands configurations
BOLLINGER_CONFIGS = {
    'standard': {
        'period': 20,
        'std_dev': 2.0,
        'band_width_threshold': 0.15,
        'breakout_strength': 0.01,
        'use_squeeze': True
    },
    'conservative': {
        'period': 25,
        'std_dev': 2.5,
        'band_width_threshold': 0.10,
        'breakout_strength': 0.02,
        'use_squeeze': True
    },
    'aggressive': {
        'period': 12,
        'std_dev': 1.5,
        'band_width_threshold': 0.20,
        'breakout_strength': 0.005,
        'use_squeeze': False
    }
}
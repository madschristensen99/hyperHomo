"""
Trading Strategy Templates
Collection of different trading strategy implementations using real market data
"""

from .rsi_strategy import RSIStrategy
from .macd_strategy import MACDStrategy  
from .bollinger_strategy import BollingerBandsStrategy
from .sma_strategy import SMAStrategy
from .ema_strategy import EMAStrategy
from .atr_strategy import ATRStrategy

__all__ = [
    'RSIStrategy',
    'MACDStrategy',
    'BollingerBandsStrategy', 
    'SMAStrategy',
    'EMAStrategy',
    'ATRStrategy'
]
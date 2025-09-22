"""
Base Strategy class for all trading strategies
Implements common functionality and interfaces
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional, List, Any
import logging
from datetime import datetime

logger = logging.getLogger("BaseStrategy")

class TradingSignal:
    """Represents a trading signal from a strategy"""
    
    def __init__(self, signal_type: str, confidence: float, reason: str, 
                 timestamp: datetime = None, metadata: Dict[str, Any] = None):
        self.signal_type = signal_type.upper()  # BUY, SELL, HOLD
        self.confidence = confidence  # 0.0 to 1.0
        self.reason = reason
        self.timestamp = timestamp or datetime.now()
        self.metadata = metadata or {}
        
    def __str__(self):
        return f"{self.signal_type} (confidence: {self.confidence:.2f}) - {self.reason}"

class BaseStrategy(ABC):
    """Abstract base class for all trading strategies"""
    
    def __init__(self, name: str, token: str = "ETH", **kwargs):
        self.name = name
        self.token = token.upper()
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        self.enabled = True
        self.history = []  # Store signal history for analysis
        
        # Strategy-specific parameters
        self.params = self._get_default_params()
        self.params.update(kwargs)
        
    @abstractmethod
    def _get_default_params(self) -> Dict[str, Any]:
        """Get default parameters for this strategy"""
        pass
        
    @abstractmethod
    def analyze(self, price_data: List[float], current_price: float, 
                volume_data: Optional[List[float]] = None) -> TradingSignal:
        """
        Analyze market data and return trading signal
        
        Args:
            price_data: List of historical prices
            current_price: Current market price
            volume_data: Optional volume data
            
        Returns:
            TradingSignal with recommendation
        """
        pass
        
    @abstractmethod
    def get_signal_type(self) -> str:
        """Get the type of this strategy (momentum, trend, volatility, etc)"""
        pass
        
    def set_parameters(self, **params):
        """Update strategy parameters"""
        self.params.update(params)
        self.logger.info(f"Updated {self.name} parameters: {params}")
    
    def get_parameters(self) -> Dict[str, Any]:
        """Get current strategy parameters"""
        return self.params.copy()
        
    def get_signal_strength(self, confidence: float) -> str:
        """Convert confidence to signal strength description"""
        if confidence >= 0.8:
            return "Very Strong"
        elif confidence >= 0.6:
            return "Strong"
        elif confidence >= 0.4:
            return "Moderate"
        elif confidence >= 0.2:
            return "Weak"
        else:
            return "Very Weak"
    
    def add_to_history(self, signal: TradingSignal):
        """Add signal to history for backtesting/analysis"""
        self.history.append(signal)
        # Keep only last 1000 signals to prevent memory issues
        if len(self.history) > 1000:
            self.history = self.history[-1000:]
    
    def get_performance_metrics(self) -> Dict[str, float]:
        """Calculate basic performance metrics from signal history"""
        if not self.history:
            return {
                "total_signals": 0,
                "avg_confidence": 0.0,
                "win_rate": 0.0,
                "profit_factor": 0.0
            }
            
        total_signals = len(self.history)
        total_confidence = sum(signal.confidence for signal in self.history)
        
        # Count signal types (simplified win rate calculation based on direction)
        buy_signals = sum(1 for signal in self.history if signal.signal_type == "BUY")
        sell_signals = sum(1 for signal in signal in self.history if signal.signal_type == "SELL")
        
        metrics = {
            "total_signals": total_signals,
            "avg_confidence": total_confidence / total_signals,
            "buy_signals": buy_signals,
            "sell_signals": sell_signals,
            "hold_signals": total_signals - buy_signals - sell_signals
        }
        
        return metrics
    
    def validate_data(self, price_data: List[float], min_periods: int = 20) -> bool:
        """Validate input data quality"""
        if not price_data:
            self.logger.warning("No price data provided")
            return False
            
        if len(price_data) < min_periods:
            self.logger.warning(f"Insufficient data: {len(price_data)} < {min_periods}")
            return False
            
        if any(price <= 0 for price in price_data):
            self.logger.warning("Invalid price data contains non-positive values")
            return False
            
        return True
    
    def __str__(self):
        return f"{self.name} ({self.token}) - {self.get_signal_type()}"
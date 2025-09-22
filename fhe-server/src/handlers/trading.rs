use tfhe::{FheUint8, ServerKey, set_server_key, ClientKey};
use tfhe::prelude::*;
use axum::{Json, http::StatusCode, extract::{State, Path}};
use serde::{Deserialize, Serialize};
use crate::AppState;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Clone, Serialize)]
pub struct Investor {
    pub address: String,
    pub amount: u128,
    //pub percent: f64,
}

#[derive(Clone)]
pub struct TradingStrategy {
    pub id: u128,
    pub name: String,
    pub owner: String, // this is the builder address
    pub token: String,
    pub upper_bound: FheUint8,
    pub lower_bound: FheUint8,
    pub amount: u128,
    pub is_open: bool,
    pub is_long: bool,
    pub investors: Vec<Investor>, // should this be a map?
 }

#[derive(Clone)]
pub struct TradingState {
    id_counter: u128,
    strategies: HashMap<u128, TradingStrategy>,
}

impl TradingState {
    pub fn new() -> Self {
        Self {
            id_counter: 0,
            strategies: HashMap::new(),
        }
    }

    pub fn create_strategy(&mut self, name: String, owner: String, upper_bound: FheUint8, lower_bound: FheUint8, token: String) -> u128 {
        self.id_counter += 1;
        let strategy_id = self.id_counter;
        self.strategies.insert(strategy_id, TradingStrategy { id: strategy_id, name, owner, upper_bound, lower_bound, amount: 0, investors: Vec::new(), is_open: false, is_long: false, token: token });
        strategy_id
    }

    pub fn get_strategy(&self, id: u128) -> Result<TradingStrategy, String> {
        match self.strategies.get(&id) {
            Some(strategy) => Ok(strategy.clone()),
            None => Err(format!("Strategy {} not found", id))
        }
    }

    pub fn get_all_strategies(&self) -> Vec<TradingStrategy> {
        self.strategies.values().cloned().collect()
    }

    pub fn increase_amount(&mut self, id: u128, amount: u128) -> Result<(), String> {
        match self.strategies.get_mut(&id) {
            Some(strategy) => {
                strategy.amount += amount;
                Ok(())
            }
            None => Err(format!("Strategy {} not found", id))
        }
    }

    pub fn add_investor(&mut self, id: u128, investor: Investor) -> Result<(), String> {
        match self.strategies.get_mut(&id) {
            Some(strategy) => {
                strategy.investors.push(investor);
                Ok(())
            }
            None => Err(format!("Strategy {} not found", id))
        }
    }

    pub fn update_strategy_position(&mut self, id: u128, is_long: bool, is_open: bool) -> Result<(), String> {
        match self.strategies.get_mut(&id) {
            Some(strategy) => {
                strategy.is_long = is_long;
                strategy.is_open = is_open;
                Ok(())
            }
            None => Err(format!("Strategy {} not found", id))
        }
    }
}

#[derive(Deserialize)]
pub struct CreateStrategyRequest {
    name: String,
    upper_bound: u8,
    lower_bound: u8,
    owner: String,
    token: String,
}

#[derive(Serialize)]
pub struct GetStrategyResponse {
    id: u128,
    name: String,
    owner: String,
    token: String,
    amount: u128,
    is_open: bool,
    is_long: bool,
    investors: Vec<Investor>,
}

#[derive(Deserialize)]
pub struct CheckLongStrategyRequest {
    strategy_id: u128,
    value: u8,
}

#[derive(Deserialize)]
pub struct CheckShortStrategyRequest {
    strategy_id: u128,
    value: u8,
}

#[derive(Deserialize)]
pub struct OpenTradeRequest {
    strategy_id: u128,
    is_long: bool,
}

#[derive(Deserialize)]
pub struct CalcRsiRequest {
    prices: Vec<f64>,
}

pub async fn create_strategy_handler(State(state): State<AppState>, Json(payload): Json<CreateStrategyRequest>) -> Result<String, (StatusCode, String)> {
    let upper_bound = FheUint8::encrypt(payload.upper_bound, &*state.client_key);
    let lower_bound = FheUint8::encrypt(payload.lower_bound, &*state.client_key);
    let name = payload.name.clone();
    let strategy_id = state.trading_state.lock().unwrap().create_strategy(payload.name, payload.owner, upper_bound, lower_bound, payload.token);
    Ok(format!("Strategy created: {} with ID: {}", name, strategy_id))
}

pub async fn get_strategy_handler(State(state): State<AppState>, Path(id): Path<u128>) -> Result<Json<GetStrategyResponse>, (StatusCode, String)> {
    let trading_state = state.trading_state.lock().unwrap();
    match trading_state.get_strategy(id) {
        Ok(strategy) => Ok(Json(GetStrategyResponse {
            id: strategy.id,
            name: strategy.name,
            owner: strategy.owner,  
            token: strategy.token,
            amount: strategy.amount,
            is_open: strategy.is_open,
            is_long: strategy.is_long,
            investors: strategy.investors,
        })),
        Err(error) => Err((StatusCode::NOT_FOUND, error))
    }
}

pub async fn get_all_strategies_handler(State(state): State<AppState>) -> Json<Vec<GetStrategyResponse>> {
    let strategies = state.trading_state.lock().unwrap().get_all_strategies();
    Json(strategies.into_iter().map(|strategy| GetStrategyResponse {
        id: strategy.id,
        name: strategy.name,
        owner: strategy.owner,
        token: strategy.token,
        amount: strategy.amount,
        is_open: strategy.is_open,
        is_long: strategy.is_long,
        investors: strategy.investors,
    }).collect())
}

pub async fn check_long_strategy_handler(State(state): State<AppState>, Json(payload): Json<CheckLongStrategyRequest>) -> Result<String, (StatusCode, String)> {
    let trading_state = state.trading_state.lock().unwrap();
    let strategy = match trading_state.get_strategy(payload.strategy_id) {
        Ok(strategy) => strategy,
        Err(error) => return Err((StatusCode::NOT_FOUND, error))
    };
    
    let lower_bound = strategy.lower_bound;
    set_server_key((*state.server_key).clone());
    let value = FheUint8::encrypt(payload.value, &*state.client_key);
    let result = lower_bound.gt(&value);
    let result_decrypted: bool = result.decrypt(&*state.client_key);
    Ok(format!("Result: {}", result_decrypted))
}

pub async fn check_short_strategy_handler(State(state): State<AppState>, Json(payload): Json<CheckShortStrategyRequest>) -> Result<String, (StatusCode, String)> {
    let trading_state = state.trading_state.lock().unwrap();
    let strategy = match trading_state.get_strategy(payload.strategy_id) {
        Ok(strategy) => strategy,
        Err(error) => return Err((StatusCode::NOT_FOUND, error))
    };
    
    let upper_bound = strategy.upper_bound;
    set_server_key((*state.server_key).clone());
    let value = FheUint8::encrypt(payload.value, &*state.client_key);
    let result = upper_bound.lt(&value);
    let result_decrypted: bool = result.decrypt(&*state.client_key);
    Ok(format!("Result: {}", result_decrypted))
}

pub async fn open_trade_handler(State(state): State<AppState>, Json(payload): Json<OpenTradeRequest>) -> Result<String, (StatusCode, String)> {
    let mut trading_state = state.trading_state.lock().unwrap();
    let strategy = match trading_state.get_strategy(payload.strategy_id) {
        Ok(strategy) => strategy,
        Err(error) => return Err((StatusCode::NOT_FOUND, error))
    };
    trading_state.update_strategy_position(payload.strategy_id, payload.is_long, true);
    Ok(format!("Trade opened"))
}

pub async fn calc_rsi(State(_state): State<AppState>, Json(payload): Json<CalcRsiRequest>) -> Result<Json<u8>, (StatusCode, String)> {
    if payload.prices.len() < 15 {
        return Err((StatusCode::BAD_REQUEST, "Need at least 15 price values for RSI calculation".to_string()));
    }

    let prices = &payload.prices;
    
    // Calculate RSI using the standard 14-period Wilder RSI
    let rsi_value = match calculate_rsi(prices) {
        Some(rsi) => rsi,
        None => return Err((StatusCode::BAD_REQUEST, "Invalid price data for RSI calculation".to_string())),
    };

    // Convert to u8 (0-100 range) and clamp
    let rsi_u8 = (rsi_value.round() as u8).min(100);
    
    Ok(Json(rsi_u8))
}

/// Standard 14-period Wilder RSI.
/// `prices` must have ≥ 15 elements (first 14 to seed the averages).
/// Returns the last RSI value (0–100).
fn calculate_rsi(prices: &[f64]) -> Option<f64> {
    if prices.len() < 15 {
        return None;
    }

    let mut avg_gain = 0.0;
    let mut avg_loss = 0.0;

    // seed the first 14-period averages
    for w in prices.windows(2).take(14) {
        let change = w[1] - w[0];
        if change > 0.0 {
            avg_gain += change;
        } else {
            avg_loss += -change;
        }
    }
    avg_gain /= 14.0;
    avg_loss /= 14.0;

    // Wilder smoothing for the rest of the slice
    for w in prices.windows(2).skip(14) {
        let change = w[1] - w[0];
        let (g, l) = if change > 0.0 {
            (change, 0.0)
        } else {
            (0.0, -change)
        };
        avg_gain = (avg_gain * 13.0 + g) / 14.0;
        avg_loss = (avg_loss * 13.0 + l) / 14.0;
    }

    let rs = avg_gain / avg_loss;
    Some(100.0 - (100.0 / (1.0 + rs)))
}

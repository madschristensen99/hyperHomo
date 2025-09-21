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
    pub name: String,
    pub owner: String, // this is the builder address
    pub upper_bound: FheUint8,
    pub lower_bound: FheUint8,
    pub amount: u128,
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

    pub fn create_strategy(&mut self, name: String, owner: String, upper_bound: FheUint8, lower_bound: FheUint8) -> u128 {
        self.id_counter += 1;
        let strategy_id = self.id_counter;
        self.strategies.insert(strategy_id, TradingStrategy { name, owner, upper_bound, lower_bound, amount: 0, investors: Vec::new() });
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
}

#[derive(Deserialize)]
pub struct CreateStrategyRequest {
    name: String,
    upper_bound: u8,
    lower_bound: u8,
    owner: String,
}

#[derive(Serialize)]
pub struct GetStrategyResponse {
    name: String,
    owner: String,
    amount: u128,
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

pub async fn create_strategy_handler(State(state): State<AppState>, Json(payload): Json<CreateStrategyRequest>) -> Result<String, (StatusCode, String)> {
    let upper_bound = FheUint8::encrypt(payload.upper_bound, &*state.client_key);
    let lower_bound = FheUint8::encrypt(payload.lower_bound, &*state.client_key);
    let name = payload.name.clone();
    let strategy_id = state.trading_state.lock().unwrap().create_strategy(payload.name, payload.owner, upper_bound, lower_bound);
    Ok(format!("Strategy created: {} with ID: {}", name, strategy_id))
}

pub async fn get_strategy_handler(State(state): State<AppState>, Path(id): Path<u128>) -> Result<Json<GetStrategyResponse>, (StatusCode, String)> {
    let trading_state = state.trading_state.lock().unwrap();
    match trading_state.get_strategy(id) {
        Ok(strategy) => Ok(Json(GetStrategyResponse {
            name: strategy.name,
            owner: strategy.owner,  
            amount: strategy.amount,
            investors: strategy.investors,
        })),
        Err(error) => Err((StatusCode::NOT_FOUND, error))
    }
}

pub async fn get_all_strategies_handler(State(state): State<AppState>) -> Json<Vec<GetStrategyResponse>> {
    let strategies = state.trading_state.lock().unwrap().get_all_strategies();
    Json(strategies.into_iter().map(|strategy| GetStrategyResponse {
        name: strategy.name,
        owner: strategy.owner,
        amount: strategy.amount,
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

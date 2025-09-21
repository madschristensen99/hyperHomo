use tfhe::{FheUint8, ServerKey, set_server_key, ClientKey};
use tfhe::prelude::*;
use axum::{Json, http::StatusCode, extract::{State, Path}};
use serde::{Deserialize, Serialize};
use crate::AppState;
use std::collections::HashMap;
use std::sync::Mutex;


#[derive(Clone)]
pub struct Position {
    pub strategy_id: u128,
    pub position_owner: String,
    pub is_open: bool,
    pub is_long: bool,
    pub amount: u128,
}

#[derive(Clone)]
pub struct TradingStrategy {
    pub name: String,
    pub owner: String, // this is the builder address
    pub upper_bound: FheUint8,
    pub lower_bound: FheUint8,
    pub positions: Vec<Position>,
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

    pub fn create_strategy(&mut self, name: String, owner: String, upper_bound: FheUint8, lower_bound: FheUint8) {
        self.id_counter += 1;
        self.strategies.insert(self.id_counter, TradingStrategy { name, owner, upper_bound, lower_bound, positions: Vec::new() });
    }

    pub fn get_strategy(&self, id: u128) -> TradingStrategy {
        self.strategies.get(&id).unwrap().clone()
    }

    pub fn get_all_strategies(&self) -> Vec<TradingStrategy> {
        self.strategies.values().cloned().collect()
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


pub async fn create_strategy_handler(State(state): State<AppState>, Json(payload): Json<CreateStrategyRequest>) -> String {
    let upper_bound = FheUint8::encrypt(payload.upper_bound, &*state.client_key);
    let lower_bound = FheUint8::encrypt(payload.lower_bound, &*state.client_key);
    let name = payload.name.clone();
    state.trading_state.lock().unwrap().create_strategy(payload.name, payload.owner, upper_bound, lower_bound);
    format!("Strategy created: {}", name)
}

pub async fn get_strategy_handler(State(state): State<AppState>, Path(id): Path<u128>) -> Json<GetStrategyResponse> {
    let strategy = state.trading_state.lock().unwrap().get_strategy(id);
    Json(GetStrategyResponse {
        name: strategy.name,
        owner: strategy.owner,  
    })
}

pub async fn get_all_strategies_handler(State(state): State<AppState>) -> Json<Vec<GetStrategyResponse>> {
    let strategies = state.trading_state.lock().unwrap().get_all_strategies();
    Json(strategies.into_iter().map(|strategy| GetStrategyResponse {
        name: strategy.name,
        owner: strategy.owner,
    }).collect())
}

pub async fn check_long_strategy_handler(State(state): State<AppState>, Json(payload): Json<CheckLongStrategyRequest>) -> String {
    let strategy = state.trading_state.lock().unwrap().get_strategy(payload.strategy_id);
    let lower_bound = strategy.lower_bound;
    set_server_key((*state.server_key).clone());
    let value = FheUint8::encrypt(payload.value, &*state.client_key);
    let result = lower_bound.gt(&value);
    let result_decrypted: bool = result.decrypt(&*state.client_key);
    format!("Result: {}", result_decrypted)
}

pub async fn check_short_strategy_handler(State(state): State<AppState>, Json(payload): Json<CheckShortStrategyRequest>) -> String {
    let strategy = state.trading_state.lock().unwrap().get_strategy(payload.strategy_id);
    let upper_bound = strategy.upper_bound;
    set_server_key((*state.server_key).clone());
    let value = FheUint8::encrypt(payload.value, &*state.client_key);
    let result = upper_bound.lt(&value);
    let result_decrypted: bool = result.decrypt(&*state.client_key);
    format!("Result: {}", result_decrypted)
}

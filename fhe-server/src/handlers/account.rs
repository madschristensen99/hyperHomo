use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use axum::{Json, extract::{State, Path}, http::StatusCode};
use crate::handlers::trading::Position;
use crate::handlers::trading::TradingState;
use crate::AppState;


#[derive(Clone, Serialize)]
pub struct Account {
    address: String, //eoa
    balance: u128, // in usdc??
}

// #[derive(Clone)]
// pub struct Limit {
//     owner: String,
//     amoun
// }


#[derive(Clone)]
pub struct AccountState {
    accounts: HashMap<String, Account>,
}

impl AccountState {
    pub fn new() -> Self {
        Self {
            accounts: HashMap::new(),
        }
    }

    pub fn create_account(&mut self, address: String, balance: u128) -> String {
        let account = Account { address: address.clone(), balance };
        self.accounts.insert(address.clone(), account);
        format!("Account created with address: {}", address)
    }

    pub fn deposit(&mut self, address: String, amount: u128) -> Result<String, String> {
        match self.accounts.get_mut(&address) {
            Some(account) => {
                account.balance += amount;
                Ok(format!("Deposited {} to account {}", amount, address))
            }
            None => Err(format!("Account {} not found", address))
        }
    }

    pub fn get_account(&self, address: String) -> Result<Account, String> {
        match self.accounts.get(&address) {
            Some(account) => Ok(account.clone()),
            None => Err(format!("Account {} not found", address))
        }
    }
}

#[derive(Deserialize)]
pub struct CreateAccountRequest {
    address: String,
    balance: u128,
}

#[derive(Deserialize)]
pub struct DepositRequest {
    address: String,
    amount: u128,
}

#[derive(Serialize)]
pub struct GetAccountResponse {
    address: String,
    balance: u128,
}

#[derive(Deserialize)]
pub struct InvestRequest {
    address: String,
    strategy_id: u128,
    amount: u128,
}

pub async fn create_account_handler(State(state): State<AppState>, Json(payload): Json<CreateAccountRequest>) -> String {
    let account = state.account_state.lock().unwrap().create_account(payload.address, payload.balance);
    format!("Account created: {}", account)
}

pub async fn deposit_handler(State(state): State<AppState>, Json(payload): Json<DepositRequest>) -> Result<String, (StatusCode, String)> {
    let mut account_state = state.account_state.lock().unwrap();
    match account_state.deposit(payload.address, payload.amount) {
        Ok(message) => Ok(message),
        Err(error) => Err((StatusCode::NOT_FOUND, error))
    }
}

pub async fn get_account_handler(State(state): State<AppState>, Path(address): Path<String>) -> Result<Json<Account>, (StatusCode, String)> {
    let account_state = state.account_state.lock().unwrap();
    match account_state.get_account(address) {
        Ok(account) => Ok(Json(account)),
        Err(error) => Err((StatusCode::NOT_FOUND, error))
    }
}

pub async fn invest_handler(State(state): State<AppState>, Json(payload): Json<InvestRequest>) -> Result<String, (StatusCode, String)> {
    let mut account_state = state.account_state.lock().unwrap();
    let mut trading_state = state.trading_state.lock().unwrap();
    let account = account_state.get_account(payload.address.clone()).unwrap();
    if account.balance >= payload.amount {
        let mut strategy = trading_state.get_strategy(payload.strategy_id);
        let hold = Position {
            strategy_id: payload.strategy_id,
            position_owner: payload.address.clone(),
            is_open: false,
            is_long: false,
            amount: payload.amount,
        };
        strategy.positions.push(hold);
        Ok(format!("Invested {} into strategy {}", payload.amount, payload.strategy_id))
    } else {
        Err((StatusCode::BAD_REQUEST, format!("Insufficient balance")))
    }
}
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use axum::{Json, extract::{State, Path}, http::StatusCode};
use crate::handlers::trading::TradingState;
use crate::AppState;
use crate::handlers::trading::Investor;


#[derive(Clone, Serialize)]
pub struct Account {
    address: String, //eoa
    balance: u128, // in usdc??
    strategy_ids: Vec<u128>,
}

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
        let account = Account { address: address.clone(), balance, strategy_ids: Vec::new() };
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

    pub fn update_account(&mut self, address: String, new_amount: u128) {
        let mut account = self.accounts.get_mut(&address).unwrap();
        account.balance = new_amount;
    }

    pub fn add_strategy_id(&mut self, address: String, strategy_id: u128) {
        let mut account = self.accounts.get_mut(&address).unwrap();
        account.strategy_ids.push(strategy_id);
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
    
    // Properly handle the case where account doesn't exist
    let account = match account_state.get_account(payload.address.clone()) {
        Ok(account) => account,
        Err(error) => return Err((StatusCode::NOT_FOUND, error))
    };
    
    if account.balance >= payload.amount {
        let investor = Investor { address: payload.address.clone(), amount: payload.amount }; 
        trading_state.add_investor(payload.strategy_id, investor);
        trading_state.increase_amount(payload.strategy_id, payload.amount);
        account_state.update_account(payload.address.clone(), account.balance - payload.amount);
        account_state.add_strategy_id(payload.address.clone(), payload.strategy_id);
        Ok(format!("Invested {} into strategy {}", payload.amount, payload.strategy_id))
    } else {
        Err((StatusCode::BAD_REQUEST, format!("Insufficient balance")))
    }
}

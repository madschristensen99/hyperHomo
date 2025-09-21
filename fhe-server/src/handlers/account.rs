use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use axum::{Json, extract::{State, Path}};
use crate::handlers::trading::Position;
use crate::handlers::trading::TradingState;
use crate::AppState;


#[derive(Clone, Serialize)]
pub struct Account {
    address: String, //eoa
    balance: u128, // in usdc??
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
        let account = Account { address: address.clone(), balance };
        self.accounts.insert(address.clone(), account);
        format!("Account created with address: {}", address)
    }

    pub fn deposit(&mut self, address: String, amount: u128) -> String {
        let account = self.accounts.get_mut(&address).unwrap();
        account.balance += amount;
        format!("Deposited {} to account {}", amount, address)
    }

    pub fn get_account(&self, address: String) -> Account {
        self.accounts.get(&address).unwrap().clone()
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

pub async fn create_account_handler(State(state): State<AppState>, Json(payload): Json<CreateAccountRequest>) -> String {
    let account = state.account_state.lock().unwrap().create_account(payload.address, payload.balance);
    format!("Account created: {}", account)
}

pub async fn deposit_handler(State(state): State<AppState>, Json(payload): Json<DepositRequest>) -> String {
    let account = state.account_state.lock().unwrap().deposit(payload.address, payload.amount);
    format!("Deposited: {}", account)
}

pub async fn get_account_handler(State(state): State<AppState>, Path(address): Path<String>) -> Json<Account> {
    let account = state.account_state.lock().unwrap().get_account(address);
    Json(account)
}


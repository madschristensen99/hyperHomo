use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use axum::{Json, extract::{State, Path}, http::StatusCode};
use crate::handlers::trading::TradingState;
use crate::AppState;
use crate::handlers::trading::Investor;
use tfhe::{FheUint8, ServerKey, set_server_key, ClientKey};
use tfhe::prelude::*;


#[derive(Clone, Serialize)]
pub struct Account {
    address: String, //eoa
    balance: u128, // in usdc??
    strategy_ids: Vec<u128>,
    limits_orders_long: HashMap<u128, LimitsOrderLong>,
    limits_orders_short: HashMap<u128, LimitsOrderShort>,
}

#[derive(Clone, Serialize)]
pub struct LimitsOrderLong {
    owner: String,
    token: String,
    asset: String,
    stop: FheUint8,
    profit: FheUint8,
}

#[derive(Clone, Serialize)]
pub struct LimitsOrderShort {
    owner: String,
    token: String,
    asset: String,
    stop: FheUint8,
    profit: FheUint8,
}

#[derive(Clone)]
pub struct AccountState {
    id_counter: u128,
    accounts: HashMap<String, Account>,
}

impl AccountState {
    pub fn new() -> Self {
        Self {
            id_counter: 0,
            accounts: HashMap::new(),
        }
    }

    pub fn create_account(&mut self, address: String, balance: u128) -> String {
        let account = Account { 
            address: address.clone(), 
            balance, 
            strategy_ids: Vec::new(), 
            limits_orders_long: HashMap::new(), 
            limits_orders_short: HashMap::new() 
        };
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

    pub fn add_limits_order_long(&mut self, address: String, limits_order_long: LimitsOrderLong) -> u128 {
        let mut account = self.accounts.get_mut(&address).unwrap();
        let order_id = self.id_counter;
        self.id_counter += 1;
        account.limits_orders_long.insert(order_id, limits_order_long);
        order_id
    }

    pub fn get_limits_orders_long(&self, address: String) -> Result<HashMap<u128, LimitsOrderLong>, String> {
        match self.accounts.get(&address) {
            Some(account) => Ok(account.limits_orders_long.clone()),
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

#[derive(Deserialize)]
pub struct AddLimitsOrderLongRequest {
    address: String,
    token: String,
    asset: String,
    stop: u8,
    profit: u8,
}

#[derive(Clone, Serialize)]
pub struct LimitsOrderLongResponse {
    owner: String,
    token: String,
    asset: String,
    stop: u8,
    profit: u8,
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

pub async fn add_limits_order_long_handler(State(state): State<AppState>, Json(payload): Json<AddLimitsOrderLongRequest>) -> Result<String, (StatusCode, String)> {
    let mut account_state = state.account_state.lock().unwrap();
    let account = account_state.get_account(payload.address.clone());
    let stop = FheUint8::encrypt(payload.stop, &*state.client_key);
    let profit = FheUint8::encrypt(payload.profit, &*state.client_key);
    let limits_order_long = LimitsOrderLong { owner: payload.address.clone(), token: payload.token.clone(), asset: payload.asset.clone(), stop, profit };
    account_state.add_limits_order_long(payload.address.clone(), limits_order_long);
    Ok(format!("Limits order long added"))
}

pub async fn get_limits_orders_long_handler(State(state): State<AppState>, Path(address): Path<String>) -> Result<Json<HashMap<u128, LimitsOrderLongResponse>>, (StatusCode, String)> {
    let account_state = state.account_state.lock().unwrap();
    match account_state.get_limits_orders_long(address) {
        Ok(limits_orders_long) => {
            set_server_key((*state.server_key).clone());
            let mut decrypted_orders = HashMap::new();
            
            for (order_id, order) in limits_orders_long {
                let decrypted_stop: u8 = order.stop.decrypt(&*state.client_key);
                let decrypted_profit: u8 = order.profit.decrypt(&*state.client_key);
                
                let decrypted_order = LimitsOrderLongResponse {
                    owner: order.owner,
                    token: order.token,
                    asset: order.asset,
                    stop: decrypted_stop,
                    profit: decrypted_profit,
                };
                
                decrypted_orders.insert(order_id, decrypted_order);
            }
            
            Ok(Json(decrypted_orders))
        },
        Err(error) => Err((StatusCode::NOT_FOUND, error))
    }
}




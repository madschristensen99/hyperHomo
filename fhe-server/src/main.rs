use axum::{
    routing::{get, post}, Router, Json, extract::State,
    http::StatusCode,
};
use std::sync::Arc;
use tfhe::{
    FheUint8,
    CompressedCiphertextListBuilder,
    set_server_key,
};
use tfhe::prelude::*;
use tfhe::{ServerKey, ClientKey};
mod fhe;
mod handlers;
use handlers::trading::TradingState;
use serde::Deserialize;
use std::sync::Mutex;


#[derive(Clone)]
struct AppState {
    server_key: Arc<ServerKey>,
    client_key: Arc<ClientKey>,
    trading_state: Arc<Mutex<TradingState>>,  // Wrap in Mutex
}

pub trait KeyAccess {
    fn get_server_key(&self) -> Arc<ServerKey>;
    fn get_client_key(&self) -> Arc<ClientKey>;
}

impl KeyAccess for AppState {
    fn get_server_key(&self) -> Arc<ServerKey> {
        self.server_key.clone()
    }
    fn get_client_key(&self) -> Arc<ClientKey> {
        self.client_key.clone()
    }
}


// Simple hello world handler
async fn hello_world(State(state): State<AppState>) -> String {
    set_server_key((*state.server_key).clone());
    let a = FheUint8::encrypt(10 as u8, &*state.client_key);
    let b = FheUint8::encrypt(5 as u8, &*state.client_key);
    let c = a + b;
    let decrypted: u8 = c.decrypt(&*state.client_key);
    println!("decrypted: {}", decrypted);
    format!("Hello, FHE World! The decrypted result is: {}", decrypted)
}


#[tokio::main]
async fn main() {

    if let Err(e) = fhe::key_gen::generate_and_save_keys() {
        eprintln!("Failed to generate keys: {}", e);
        return;
    }

    let trading_state = TradingState::new();

    let state = AppState { 
        server_key: Arc::new(fhe::key_gen::load_server_key().unwrap()),
        client_key: Arc::new(fhe::key_gen::load_client_key().unwrap()),
        trading_state: Arc::new(Mutex::new(trading_state)),
    };


    let app = Router::new()
        .route("/", get(hello_world))
        .route("/create_strategy", post(handlers::trading::create_strategy_handler))
        .route("/check_long_strategy", post(handlers::trading::check_long_strategy_handler))
        .route("/check_short_strategy", post(handlers::trading::check_short_strategy_handler))
        .route("/get_strategy/:id", get(handlers::trading::get_strategy_handler))
        .route("/get_all_strategies", get(handlers::trading::get_all_strategies_handler))
        .with_state(state);

    
    println!("Server running on http://0.0.0.0:3000");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    println!("Hello, world!");
}

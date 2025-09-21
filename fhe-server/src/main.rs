use axum::{
    routing::{get, post}, Router, extract::State,
    http::{HeaderMap, Method, Request, Response, StatusCode},
    middleware::{self, Next},
    response::IntoResponse,
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
use crate::handlers::account::AccountState;
use handlers::trading::TradingState;
use serde::Deserialize;
use std::sync::Mutex;


#[derive(Clone)]
struct AppState {
    server_key: Arc<ServerKey>,
    client_key: Arc<ClientKey>,
    trading_state: Arc<Mutex<TradingState>>,
    account_state: Arc<Mutex<AccountState>>,
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
    let account_state = AccountState::new();

    let state = AppState { 
        server_key: Arc::new(fhe::key_gen::load_server_key().unwrap()),
        client_key: Arc::new(fhe::key_gen::load_client_key().unwrap()),
        trading_state: Arc::new(Mutex::new(trading_state)),
        account_state: Arc::new(Mutex::new(account_state)),
    };

<<<<<<< HEAD
=======

    // We'll use our own CORS middleware

>>>>>>> 249f71bbb52518528442d22755da4e3e51724abf
    let app = Router::new()
        .route("/", get(hello_world))
        .route("/create_strategy", post(handlers::trading::create_strategy_handler))
        .route("/check_long_strategy", post(handlers::trading::check_long_strategy_handler))
        .route("/check_short_strategy", post(handlers::trading::check_short_strategy_handler))
        .route("/get_strategy/:id", get(handlers::trading::get_strategy_handler))
        .route("/get_all_strategies", get(handlers::trading::get_all_strategies_handler))
<<<<<<< HEAD
        .route("/create_account", post(handlers::account::create_account_handler))
        .route("/deposit", post(handlers::account::deposit_handler))
        .route("/get_account/:address", get(handlers::account::get_account_handler))
=======
        .layer(middleware::from_fn(cors_middleware))
>>>>>>> 249f71bbb52518528442d22755da4e3e51724abf
        .with_state(state);

    
    println!("Server running on http://0.0.0.0:3000");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    println!("Hello, world!");
}

// Custom CORS middleware
async fn cors_middleware(req: Request<axum::body::Body>, next: Next) -> impl IntoResponse {
    // Get the origin from the request headers
    let origin = req.headers()
        .get("Origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("*");
    let origin_str = origin.to_string();

    // Handle preflight OPTIONS request
    if req.method() == Method::OPTIONS {
        let mut headers = HeaderMap::new();
        headers.insert("Access-Control-Allow-Origin", origin_str.parse().unwrap());
        headers.insert("Access-Control-Allow-Methods", "GET, POST, OPTIONS".parse().unwrap());
        headers.insert("Access-Control-Allow-Headers", "Content-Type".parse().unwrap());
        headers.insert("Access-Control-Max-Age", "86400".parse().unwrap()); // 24 hours
        
        return (StatusCode::OK, headers, "").into_response();
    }

    // For regular requests, add CORS headers to the response
    let mut response = next.run(req).await;
    
    let headers = response.headers_mut();
    headers.insert("Access-Control-Allow-Origin", origin_str.parse().unwrap());
    headers.insert("Access-Control-Allow-Methods", "GET, POST, OPTIONS".parse().unwrap());
    headers.insert("Access-Control-Allow-Headers", "Content-Type".parse().unwrap());
    
    response
}

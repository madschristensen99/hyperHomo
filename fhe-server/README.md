# FHE Server for HyperHomo

This is the Fully Homomorphic Encryption (FHE) server component of the HyperHomo platform. It provides a secure backend for creating and evaluating encrypted trading strategies within a Trusted Execution Environment (TEE).

## Overview

The FHE server is built with Rust and leverages the TFHE library for homomorphic encryption operations. It runs within a TEE to provide hardware-level security guarantees and verifiable privacy.

## Features

- Fully Homomorphic Encryption for secure computation on encrypted data
- Trusted Execution Environment (TEE) for verifiable privacy guarantees
- RESTful API for strategy creation and evaluation
- Encrypted bounds checking for trading signals

## API Endpoints

The server exposes the following RESTful API endpoints:

### 1. Root Endpoint

- **URL**: `/`
- **Method**: `GET`
- **Description**: Simple hello world endpoint that demonstrates FHE operations by adding two encrypted numbers.
- **Response**: Plain text message with the decrypted result of the FHE addition operation.

### 2. Create Strategy

- **URL**: `/create_strategy`
- **Method**: `POST`
- **Description**: Creates a new encrypted trading strategy with upper and lower bounds.
- **Request Body**:
  ```json
  {
    "name": "Strategy Name",
    "upper_bound": 100,
    "lower_bound": 50,
    "owner": "owner_address"
  }
  ```
- **Response**: Plain text confirmation message.

### 3. Check Long Strategy

- **URL**: `/check_long_strategy`
- **Method**: `POST`
- **Description**: Checks if a value is below the lower bound of a strategy (encrypted comparison).
- **Request Body**:
  ```json
  {
    "strategy_id": 123456789,
    "value": 45
  }
  ```
- **Response**: Plain text result of the encrypted comparison.

### 4. Check Short Strategy

- **URL**: `/check_short_strategy`
- **Method**: `POST`
- **Description**: Checks if a value is above the upper bound of a strategy (encrypted comparison).
- **Request Body**:
  ```json
  {
    "strategy_id": 123456789,
    "value": 105
  }
  ```
- **Response**: Plain text result of the encrypted comparison.

### 5. Get Strategy

- **URL**: `/get_strategy/:id`
- **Method**: `GET`
- **Description**: Retrieves information about a specific strategy by ID.
- **URL Parameters**: `id` - The unique identifier of the strategy.
- **Response**: JSON object with strategy information (excluding encrypted bounds).
  ```json
  {
    "name": "Strategy Name",
    "owner": "owner_address"
  }
  ```

### 6. Get All Strategies

- **URL**: `/get_all_strategies`
- **Method**: `GET`
- **Description**: Retrieves information about all available strategies.
- **Response**: JSON array of strategy objects (excluding encrypted bounds).
  ```json
  [
    {
      "name": "Strategy 1",
      "owner": "owner_address_1"
    },
    {
      "name": "Strategy 2",
      "owner": "owner_address_2"
    }
  ]
  ```

## FHE Implementation Details

The server uses the TFHE (Fast Fully Homomorphic Encryption over the Torus) library for encrypted operations:

1. **Key Generation**: The server generates and manages client, server, and public keys.
2. **Encrypted Integers**: Uses `FheUint8` for encrypted integer operations.
3. **Homomorphic Operations**: Supports encrypted comparisons (`gt`, `lt`) for strategy evaluation.

## TEE Integration

The server runs within a Trusted Execution Environment (TEE) to provide:

1. **Memory Encryption**: All memory used by the FHE operations is encrypted.
2. **Isolation**: The TEE provides hardware-level isolation from other processes.
3. **Attestation**: Remote attestation capabilities to verify the integrity of the execution environment.

## Building and Running

### Prerequisites

- Rust 1.83 or later
- Docker and Docker Compose (for containerized deployment)

### Local Development

```bash
# Build the project
cargo build

# Run the server
cargo run
```

### Docker Deployment

```bash
# Build the Docker image
docker build -t fhe-server .

# Run with Docker Compose
DOCKER_IMAGE=fhe-server docker-compose up
```

The server will be available at `http://localhost:3000`.

## Security Considerations

- Key management is critical - the server generates keys on first run and stores them in the `keys` directory.
- The security of the system depends on the underlying TEE implementation.
- While FHE operations are secure, side-channel attacks may still be possible depending on the implementation.

## Dependencies

- `axum`: Web framework for building the API
- `tokio`: Asynchronous runtime
- `tfhe`: Fully Homomorphic Encryption library
- `bincode`: Binary serialization
- `serde`: Serialization framework

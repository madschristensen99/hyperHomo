# Use official Rust image as builder
FROM rust:1.83 AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build the application
RUN cargo build --release

# Runtime image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/target/release/fhe-tee ./fhe-tee

# Expose the port your server runs on
EXPOSE 3000

# Run the binary
CMD ["./fhe-tee"]
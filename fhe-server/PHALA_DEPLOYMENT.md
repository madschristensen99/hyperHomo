# Deploying Rust FHE Server on Phala TEE

This guide will help you deploy your Rust FHE (Fully Homomorphic Encryption) server on Phala TEE for secure computation with excellent cost-effectiveness and security.

## Prerequisites

- Rust installed locally
- Docker installed and running
- Docker Hub account

## 1. Install Phala CLI

```bash
# Install Phala CLI
npm install -g @phala/cli

# Verify installation
phala --version
```

## 2. Setup Accounts and Authentication

1. Create Phala account at [cloud.phala.network](https://cloud.phala.network)
2. You will get free credits if you sign up for the first time
3. Create API token in dashboard → API Tokens
4. Authenticate:

```bash
export PHALA_CLOUD_API_KEY=your_api_key_here

# Login to Docker Hub
docker login
# Enter your Docker Hub credentials
```

## 3. Configure Environment Variables

Create a `.env` file for production:

```env
# Docker image (will be set after building)
DOCKER_IMAGE=yourusername/fhe-tee:v1.0.0

# Rust environment
RUST_LOG=info

# Add any other environment variables your server needs
```

## 4. Build and Test Locally

```bash
# Test local build
cargo build --release

# Test local run
cargo run

# Test Docker build
docker build -t fhe-tee:local .

# Test Docker run
docker run -p 3000:3000 fhe-tee:local
```

Visit `http://localhost:3000` to verify it works.

## 5. Build and Push Docker Image

```bash
# Build your Docker image with Phala CLI
phala docker build --image fhe-tee --tag v1.0.0

# Push to Docker Hub
phala docker push
```

Update your `.env` file with the pushed image:

```env
DOCKER_IMAGE=yourusername/fhe-tee:v1.0.0
```

## 6. Deploy to Phala TEE

```bash
phala cvms create --name fhe-tee-server --compose ./docker-compose.yaml --env-file ./.env
```

When prompted for resources:
- **vCPUs**: 2 (sufficient for FHE computations)
- **Memory**: 4096 MB (4GB recommended for FHE operations)
- **Disk**: 20 GB (adequate for this server)
- **TEEPod**: Select any online TEE pod

## 9. Access Your Deployed Server

After deployment:

1. You'll receive an **App URL** - this is your cloud dashboard
2. Visit the App URL to monitor your deployment
3. In the dashboard, go to **Network → "Endpoint #1"**
4. This gives you your server's public URL
5. Test your server: `https://your-endpoint-url/`

## 10. Monitoring and Management

- Use the Phala dashboard to monitor resource usage
- Check logs in the dashboard under "Logs" section
- Scale resources if needed for heavy FHE operations
- Monitor costs in the billing section

## Troubleshooting

### Common Issues:

1. **Build failures**: Ensure all Rust dependencies are properly specified in `Cargo.toml`
2. **Memory issues**: FHE operations are memory-intensive; consider upgrading to 8GB if needed
3. **Port conflicts**: Ensure port 3000 is correctly exposed in Docker configuration
4. **Key generation failures**: Verify the FHE key generation works in local Docker testing

### Debug Commands:

```bash
# Check deployment status
phala cvms list

# View logs
phala cvms logs --name fhe-tee-server

# Update deployment
phala cvms update --name fhe-tee-server --compose ./docker-compose.yaml
```

## Security Benefits

Deploying on Phala TEE provides:
- **Confidential Computing**: FHE operations run in secure enclaves
- **Data Privacy**: Input data remains encrypted during computation
- **Verifiable Execution**: TEE ensures code integrity
- **Decentralized Infrastructure**: Resistant to single points of failure

Your FHE server is now running securely on Phala TEE! 🎉
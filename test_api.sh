#!/bin/bash

# Test script for HyperHomo FHE Trading API
# Make sure the server is running on localhost:3000

BASE_URL="http://localhost:3000"

echo "🚀 Testing HyperHomo FHE Trading API"
echo "====================================="

# Test 1: Hello World (FHE demo)
echo -e "\n1. Testing Hello World (FHE demo)..."
curl -X GET "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Test 2: Create a trading strategy
echo -e "\n2. Creating a trading strategy..."
STRATEGY_RESPONSE=$(curl -s -X POST "$BASE_URL/create_strategy" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Strategy",
    "upper_bound": 100,
    "lower_bound": 50,
    "owner": "0x1234567890abcdef"
  }')

echo "$STRATEGY_RESPONSE"

# Extract strategy ID from response (assuming format: "Strategy created: Test Strategy with ID: 1")
STRATEGY_ID=$(echo "$STRATEGY_RESPONSE" | grep -o 'ID: [0-9]*' | grep -o '[0-9]*')
echo "Strategy ID: $STRATEGY_ID"

# Test 3: Get all strategies
echo -e "\n3. Getting all strategies..."
curl -X GET "$BASE_URL/get_all_strategies" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Test 4: Get specific strategy
if [ ! -z "$STRATEGY_ID" ]; then
  echo -e "\n4. Getting strategy $STRATEGY_ID..."
  curl -X GET "$BASE_URL/get_strategy/$STRATEGY_ID" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n"
fi

# Test 5: Check long strategy (value below lower bound)
if [ ! -z "$STRATEGY_ID" ]; then
  echo -e "\n5. Checking long strategy (value=30, should be below lower_bound=50)..."
  curl -X POST "$BASE_URL/check_long_strategy" \
    -H "Content-Type: application/json" \
    -d "{
      \"strategy_id\": $STRATEGY_ID,
      \"value\": 30
    }" \
    -w "\nStatus: %{http_code}\n"
fi

# Test 6: Check short strategy (value above upper bound)
if [ ! -z "$STRATEGY_ID" ]; then
  echo -e "\n6. Checking short strategy (value=120, should be above upper_bound=100)..."
  curl -X POST "$BASE_URL/check_short_strategy" \
    -H "Content-Type: application/json" \
    -d "{
      \"strategy_id\": $STRATEGY_ID,
      \"value\": 120
    }" \
    -w "\nStatus: %{http_code}\n"
fi

# Test 7: Create an account
echo -e "\n7. Creating an account..."
curl -X POST "$BASE_URL/create_account" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef",
    "balance": 1000
  }' \
  -w "\nStatus: %{http_code}\n"

# Test 8: Get account
echo -e "\n8. Getting account..."
curl -X GET "$BASE_URL/get_account/0x1234567890abcdef" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Test 9: Deposit to account
echo -e "\n9. Depositing to account..."
curl -X POST "$BASE_URL/deposit" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef",
    "amount": 500
  }' \
  -w "\nStatus: %{http_code}\n"

# Test 10: Invest in strategy
if [ ! -z "$STRATEGY_ID" ]; then
  echo -e "\n10. Investing in strategy $STRATEGY_ID..."
  curl -X POST "$BASE_URL/invest" \
    -H "Content-Type: application/json" \
    -d "{
      \"address\": \"0x1234567890abcdef\",
      \"strategy_id\": $STRATEGY_ID,
      \"amount\": 100
    }" \
    -w "\nStatus: %{http_code}\n"
fi

echo -e "\n✅ API testing complete!"
echo "Note: Make sure the FHE server is running with: cargo run"

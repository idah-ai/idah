#!/bin/bash

################################################################################
# IDAH API Example: Authenticate with API Key
################################################################################
#
# This script demonstrates how to authenticate using an IDAH API key and
# retrieve a JWT token for subsequent API calls.
#
# Usage:
#   IDAH_API_KEY="your_key" ./01_authenticate.sh
#   or
#   ./01_authenticate.sh your_key
#
# Environment Variables:
#   IDAH_URL        - Base IDAH URL (default: https://idah.localhost:8443)
#                     Examples: https://idah.localhost:8443 (local)
#                               https://idah.ingedata.ai (staging/prod)
#   IDAH_API_KEY    - Your API key (can also be passed as first argument)
#   IAM_SERVICE_URL - Override IAM service URL (default: ${IDAH_URL}/api/v1/iam)
#
# Notes:
#   - For localhost URLs, curl will automatically use -k flag (insecure SSL)
#   - For production URLs, SSL certificates will be verified
#
# Requirements:
#   - curl
#   - jq (optional, for pretty printing)
#
################################################################################

set -e  # Exit on error

# Color output helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
# IDAH_URL can be set as environment variable (e.g., https://idah.localhost:8443 or https://idah.ingedata.ai)
IDAH_URL="${IDAH_URL:-https://idah.localhost:8443}"
IAM_SERVICE_URL="${IAM_SERVICE_URL:-${IDAH_URL}/api/v1/iam}"
API_KEY="${1:-$IDAH_API_KEY}"

# Detect localhost and set curl insecure flag if needed
if [[ "$IDAH_URL" =~ localhost ]]; then
    CURL_INSECURE="-k"
else
    CURL_INSECURE=""
fi

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: API key not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" $0"
    echo "   or: $0 your_key"
    exit 1
fi

# Check if API key has the correct format
if [[ ! "$API_KEY" =~ ^IDAH_ ]] || [ ${#API_KEY} -ne 69 ]; then
    echo -e "${YELLOW}Warning: API key doesn't match expected format (should start with 'IDAH_' and be 69 characters)${NC}"
fi

echo -e "${GREEN}=== IDAH API Key Authentication ===${NC}"
echo "IDAH URL: $IDAH_URL"
echo "IAM Service URL: $IAM_SERVICE_URL"
echo "API Key: ${API_KEY:0:20}...${API_KEY: -10}"
echo ""

# Make authentication request
echo -e "${GREEN}Sending authentication request...${NC}"
RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X POST "${IAM_SERVICE_URL}/auth/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\":\"${API_KEY}\"}")

echo -e "${GREEN}Response received:${NC}"
# Extract HTTP status code and response body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Authentication successful!${NC}"
    echo ""

    # Try to parse with jq if available, otherwise show raw response
    if command -v jq &> /dev/null; then
        # Extract token from meta field
        TOKEN=$(echo "$BODY" | jq -r '.meta.token // empty')
        ACCOUNT_ID=$(echo "$BODY" | jq -r '.data.id // empty')
        ACCOUNT_EMAIL=$(echo "$BODY" | jq -r '.data.attributes.email // empty')
        ACCOUNT_NAME=$(echo "$BODY" | jq -r '.data.attributes.name // empty')
        ROLE_NAME=$(echo "$BODY" | jq -r '.data.attributes.role_name // empty')
        EXPIRES_AT=$(echo "$BODY" | jq -r '.data.attributes.exp // empty')

        echo -e "${GREEN}Authentication Details:${NC}"
        echo "  Account ID: $ACCOUNT_ID"
        echo "  Email: $ACCOUNT_EMAIL"
        echo "  Name: $ACCOUNT_NAME"
        echo "  Role: $ROLE_NAME"
        echo "  Token Expires At: $EXPIRES_AT ($(date -d @$EXPIRES_AT 2>/dev/null || date -r $EXPIRES_AT 2>/dev/null || echo 'N/A'))"
        echo ""
        echo -e "${GREEN}JWT Token:${NC}"
        echo "$TOKEN"
        echo ""
        echo -e "${YELLOW}Save this token for use in other API requests:${NC}"
        echo "export AUTH_TOKEN=\"$TOKEN\""
        echo ""

        # Save token to a file for use by other scripts
        echo "$TOKEN" > /tmp/idah_auth_token.txt
        echo -e "${GREEN}Token saved to: /tmp/idah_auth_token.txt${NC}"

    else
        echo "Response:"
        echo "$BODY"
        echo ""
        echo -e "${YELLOW}Install 'jq' for better JSON formatting${NC}"
    fi
else
    echo -e "${RED}✗ Authentication failed!${NC}"
    echo "Response:"
    echo "$BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Next Steps ===${NC}"
echo "Use the token above in the 'Authorization' header for authenticated requests:"
echo "  Authorization: Bearer <token>"
echo ""
echo "Example:"
echo "  curl -H \"Authorization: Bearer \$AUTH_TOKEN\" ${DATASET_SERVICE_URL}/projects"

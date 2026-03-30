#!/bin/bash

################################################################################
# IDAH API Example: Create a New Project
################################################################################
#
# This script demonstrates how to create a new project using the Dataset service
# after authenticating with an API key.
#
# Usage:
#   IDAH_API_KEY="your_key" ORGANIZATION_ID="123" ./02_create_project.sh
#   or
#   ./02_create_project.sh your_key organization_id [project_name]
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
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
# IDAH_URL can be set as environment variable (e.g., https://idah.localhost:8443 or https://idah.ingedata.ai)
IDAH_URL="${IDAH_URL:-https://idah.localhost:8443}"
IAM_SERVICE_URL="${IAM_SERVICE_URL:-${IDAH_URL}/api/v1/iam}"
DATASET_SERVICE_URL="${DATASET_SERVICE_URL:-${IDAH_URL}/api/v1/dataset}"
API_KEY="${1:-$IDAH_API_KEY}"
ORGANIZATION_ID="${2:-$ORGANIZATION_ID}"
PROJECT_NAME="${3:-API Test Project - $(date +%Y%m%d_%H%M%S)}"

# Detect localhost and set curl insecure flag if needed
if [[ "$IDAH_URL" =~ localhost ]]; then
    CURL_INSECURE="-k"
else
    CURL_INSECURE=""
fi

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: API key not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" ORGANIZATION_ID=\"org_id\" $0"
    echo "   or: $0 your_key organization_id [project_name]"
    exit 1
fi

# Check if organization ID is provided
if [ -z "$ORGANIZATION_ID" ]; then
    echo -e "${RED}Error: Organization ID not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" ORGANIZATION_ID=\"org_id\" $0"
    echo "   or: $0 your_key organization_id [project_name]"
    exit 1
fi

echo -e "${GREEN}=== IDAH API: Create Project ===${NC}"
echo "IDAH URL: $IDAH_URL"
echo "IAM Service URL: $IAM_SERVICE_URL"
echo "Dataset Service URL: $DATASET_SERVICE_URL"
echo "Organization ID: $ORGANIZATION_ID"
echo "Project Name: $PROJECT_NAME"
echo ""

# Step 1: Authenticate and get token
echo -e "${BLUE}[Step 1/2] Authenticating with API key...${NC}"
AUTH_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X POST \
    "${IAM_SERVICE_URL}/auth/api/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"api_key\": \"${API_KEY}\",
        \"token_expiration\": 3600
    }")

HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
AUTH_BODY=$(echo "$AUTH_RESPONSE" | sed '$d')


if [ "$HTTP_CODE" -ne 200 ] && [ "$HTTP_CODE" -ne 201 ]; then
    echo -e "${RED}✗ Authentication failed! (HTTP $HTTP_CODE)${NC}"
    echo "$AUTH_BODY"
    exit 1
fi

echo "{$AUTH_BODY}"

# Extract token
if command -v jq &> /dev/null; then
    AUTH_TOKEN=$(echo "$AUTH_BODY" | jq -r '.meta.token')
else
    # Fallback: extract token without jq (basic parsing)
    AUTH_TOKEN=$(printf '%s' "$AUTH_BODY" \
        | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "null" ]; then
    echo -e "${RED}✗ Failed to extract authentication token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authentication successful${NC}"
echo ""

# Step 2: Create project
echo -e "${BLUE}[Step 2/2] Creating project...${NC}"
PROJECT_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X POST \
    "${DATASET_SERVICE_URL}/projects" \
    -H "Content-Type: application/vnd.api+json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -d "{
        \"data\": {
            \"type\": \"dataset:projects\",
            \"attributes\": {
                \"name\": \"${PROJECT_NAME}\",
                \"description\": \"Project created via API\",
                \"organization_id\": ${ORGANIZATION_ID}
            }
        }
    }")

HTTP_CODE=$(echo "$PROJECT_RESPONSE" | tail -n1)
PROJECT_BODY=$(echo "$PROJECT_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Project created successfully!${NC}"
    echo ""

    if command -v jq &> /dev/null; then
        PROJECT_ID=$(echo "$PROJECT_BODY" | jq -r '.data.id')
        PROJECT_NAME_RESP=$(echo "$PROJECT_BODY" | jq -r '.data.attributes.name')
        CREATED_AT=$(echo "$PROJECT_BODY" | jq -r '.data.attributes.created_at')

        echo -e "${GREEN}Project Details:${NC}"
        echo "  Project ID: $PROJECT_ID"
        echo "  Name: $PROJECT_NAME_RESP"
        echo "  Organization ID: $ORGANIZATION_ID"
        echo "  Created At: $CREATED_AT"
        echo ""

        # Save project ID for use in other scripts
        echo "$PROJECT_ID" > /tmp/idah_project_id.txt
        echo -e "${GREEN}Project ID saved to: /tmp/idah_project_id.txt${NC}"

        echo ""
        echo -e "${YELLOW}Use this project ID for creating datasets:${NC}"
        echo "export PROJECT_ID=\"$PROJECT_ID\""

    else
        echo "Response:"
        echo "$PROJECT_BODY" | head -20
        echo ""
        echo -e "${YELLOW}Install 'jq' for better JSON formatting${NC}"
    fi
else
    echo -e "${RED}✗ Failed to create project! (HTTP $HTTP_CODE)${NC}"
    echo "Response:"
    echo "$PROJECT_BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Next Steps ===${NC}"
echo "You can now create datasets in this project using:"
echo "  $API_KEY $PROJECT_ID ./03_create_dataset.sh"

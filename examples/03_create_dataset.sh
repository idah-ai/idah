#!/bin/bash

################################################################################
# IDAH API Example: Create a Dataset
################################################################################
#
# This script demonstrates how to create a new dataset using the Dataset service
# after authenticating with an API key.
#
# Usage:
#   IDAH_API_KEY="your_key" PROJECT_ID="123" MODALITY="video" ./03_create_dataset.sh
#   or
#   ./03_create_dataset.sh your_key project_id [dataset_name] [modality]
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
PROJECT_ID="${2:-$PROJECT_ID}"
DATASET_NAME="${3:-API Test Dataset - $(date +%Y%m%d_%H%M%S)}"
RAW_MODALITY="${4:-video}" # Options: image, video, text, audio, etc.
MODALITY="idah-${RAW_MODALITY}"

# Detect localhost and set curl insecure flag if needed
if [[ "$IDAH_URL" =~ localhost ]]; then
    CURL_INSECURE="-k"
else
    CURL_INSECURE=""
fi

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: API key not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" $0"
    echo "   or: $0 your_key project_id [dataset_name] [modality]"
    exit 1
fi

# Check if project ID is provided
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: Project ID not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" $0"
    echo "   or: $0 your_key project_id [dataset_name] [modality]"
    exit 1
fi

echo -e "${GREEN}=== IDAH API: Create Dataset ===${NC}"
echo "IDAH URL: $IDAH_URL"
echo "IAM Service URL: $IAM_SERVICE_URL"
echo "Dataset Service URL: $DATASET_SERVICE_URL"
echo "Project ID: $PROJECT_ID"
echo "Dataset Name: $DATASET_NAME"
echo "Modality: $MODALITY"
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

# Step 2: Create dataset
echo -e "${BLUE}[Step 2/2] Creating dataset...${NC}"
DATASET_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X POST \
    "${DATASET_SERVICE_URL}/datasets" \
    -H "Content-Type: application/vnd.api+json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -d "{
        \"data\": {
            \"type\": \"dataset:datasets\",
            \"attributes\": {
                \"name\": \"${DATASET_NAME}\",
                \"description\": \"Dataset created via API\",
                 \"labeling_configuration\": {},
                \"workflow_configuration\": {},
                \"modality\": \"${MODALITY}\",
                \"status\": \"pending\"
            },
            \"relationships\": {
                \"project\": {
                    \"data\": {
                        \"type\": \"projects\",
                        \"id\": \"${PROJECT_ID}\"
                    }
                }
            }
        }
    }")

HTTP_CODE=$(echo "$DATASET_RESPONSE" | tail -n1)
DATASET_BODY=$(echo "$DATASET_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Dataset created successfully!${NC}"
    echo ""

    if command -v jq &> /dev/null; then
        DATASET_ID=$(echo "$DATASET_BODY" | jq -r '.data.id')
        DATASET_NAME_RESP=$(echo "$DATASET_BODY" | jq -r '.data.attributes.name')
        DATASET_STATUS=$(echo "$DATASET_BODY" | jq -r '.data.attributes.status')
        CREATED_AT=$(echo "$DATASET_BODY" | jq -r '.data.attributes.created_at')

        echo -e "${GREEN}Dataset Details:${NC}"
        echo "  Dataset ID: $DATASET_ID"
        echo "  Name: $DATASET_NAME_RESP"
        echo "  Modality: $MODALITY"
        echo "  Status: $DATASET_STATUS"
        echo "  Project ID: $PROJECT_ID"
        echo "  Created At: $CREATED_AT"
        echo ""

        # Save dataset ID for use in other scripts
        echo "$DATASET_ID" > /tmp/idah_dataset_id.txt
        echo -e "${GREEN}Dataset ID saved to: /tmp/idah_dataset_id.txt${NC}"

    else
        echo "Response:"
        echo "$DATASET_BODY" | head -20
        echo ""
        echo -e "${YELLOW}Install 'jq' for better JSON formatting${NC}"

        # Try to extract dataset ID without jq
        DATASET_ID=$(echo "$DATASET_BODY" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    fi


else
    echo -e "${RED}✗ Failed to create dataset! (HTTP $HTTP_CODE)${NC}"
    echo "Response:"
    echo "$DATASET_BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Next Steps ===${NC}"
if [ -n "$DATASET_ID" ] && [ "$DATASET_ID" != "null" ]; then
    echo "Dataset created with ID: $DATASET_ID"
    echo ""
    echo "You can now:"
    echo "  1. Add entries to this dataset using:"
    echo "     $API_KEY $PROJECT_ID $DATASET_ID $MEDIA_FILE ./03_create_entries.sh"
    echo "  2. Annotate the entries"
    echo "  3. Export annotations using:"
    echo "     $API_KEY $PROJECT_ID $DATASET_ID ./04_export_annotations.sh "
else
    echo -e "${YELLOW}Could not extract dataset ID from response${NC}"
fi

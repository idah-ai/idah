#!/bin/bash

################################################################################
# IDAH API Example: Create Dataset Entries
################################################################################
#
# This script demonstrates how to create entries in an existing dataset
# by first uploading media files and then creating entries with those media resources.
#
# Usage:
#   IDAH_API_KEY="your_key" PROJECT_ID="123" DATASET_ID="456" MEDIA_FILE="video.mp4" ./03_create_entries.sh
#   or
#   ./03_create_entries.sh your_key project_id dataset_id media_file_path
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
MEDIA_SERVICE_URL="${MEDIA_SERVICE_URL:-${IDAH_URL}/api/v1/media}"
API_KEY="${1:-$IDAH_API_KEY}"
PROJECT_ID="${2:-$PROJECT_ID}"
DATASET_ID="${3:-$DATASET_ID}"
MEDIA_FILE="${4:-$MEDIA_FILE}"

# Detect localhost and set curl insecure flag if needed
if [[ "$IDAH_URL" =~ localhost ]]; then
    CURL_INSECURE="-k"
else
    CURL_INSECURE=""
fi

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: API key not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" DATASET_ID=\"dataset_id\" MEDIA_FILE=\"file.mp4\" $0"
    echo "   or: $0 your_key project_id dataset_id media_file"
    exit 1
fi

# Check if project ID is provided
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: Project ID not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" DATASET_ID=\"dataset_id\" MEDIA_FILE=\"file.mp4\" $0"
    echo "   or: $0 your_key project_id dataset_id media_file"
    exit 1
fi

# Check if dataset ID is provided
if [ -z "$DATASET_ID" ]; then
    # Try to read from temp file if available
    if [ -f "/tmp/idah_dataset_id.txt" ]; then
        DATASET_ID=$(cat /tmp/idah_dataset_id.txt)
        echo -e "${GREEN}Found dataset ID in /tmp/idah_dataset_id.txt: $DATASET_ID${NC}"
    else
        echo -e "${RED}Error: Dataset ID not provided${NC}"
        echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" DATASET_ID=\"dataset_id\" MEDIA_FILE=\"file.mp4\" $0"
        echo "   or: $0 your_key project_id dataset_id media_file"
        exit 1
    fi
fi

# Check if media file is provided and exists
if [ -z "$MEDIA_FILE" ]; then
    echo -e "${RED}Error: Media file not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" DATASET_ID=\"dataset_id\" MEDIA_FILE=\"file.mp4\" $0"
    echo "   or: $0 your_key project_id dataset_id media_file"
    exit 1
fi

if [ ! -f "$MEDIA_FILE" ]; then
    echo -e "${RED}Error: Media file not found: $MEDIA_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}=== IDAH API: Create Dataset Entry with Media ===${NC}"
echo "IDAH URL: $IDAH_URL"
echo "IAM Service URL: $IAM_SERVICE_URL"
echo "Media Service URL: $MEDIA_SERVICE_URL"
echo "Dataset Service URL: $DATASET_SERVICE_URL"
echo "Project ID: $PROJECT_ID"
echo "Dataset ID: $DATASET_ID"
echo "Media File: $MEDIA_FILE"
echo ""

# Step 1: Authenticate and get token
echo -e "${BLUE}[Step 1/3] Authenticating with API key...${NC}"
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
    AUTH_TOKEN=$(printf '%s' "$AUTH_BODY" \
    | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "null" ]; then
    echo -e "${RED}✗ Failed to extract authentication token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authentication successful${NC}"
echo ""

# Step 2: Upload media file
echo -e "${BLUE}[Step 2/3] Uploading media file...${NC}"

# Generate unique resource ID with file extension
FILENAME=$(basename "$MEDIA_FILE")
FILE_EXTENSION="${FILENAME##*.}"
RESOURCE_ID=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 16 | head -n 1)
RESOURCE_KEY="${RESOURCE_ID}.${FILE_EXTENSION}"

echo "Generated resource ID: $RESOURCE_KEY"
echo ""

MEDIA_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X POST \
    "${MEDIA_SERVICE_URL}/medias/files/${RESOURCE_KEY}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -F "file=@${MEDIA_FILE}" \
    -F "project_id=${PROJECT_ID}" \
    -F "resource=${RESOURCE_KEY}" \
    -F "key=")

HTTP_CODE=$(echo "$MEDIA_RESPONSE" | tail -n1)
MEDIA_BODY=$(echo "$MEDIA_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Media uploaded successfully!${NC}"
    echo ""

    if command -v jq &> /dev/null; then
        MEDIA_RESOURCE=$(echo "$MEDIA_BODY" | jq -r '.data.attributes.resource')
        MEDIA_MIME_TYPE=$(echo "$MEDIA_BODY" | jq -r '.data.attributes.mime_type')
        MEDIA_SIZE=$(echo "$MEDIA_BODY" | jq -r '.data.attributes.size')

        echo -e "${GREEN}Media Details:${NC}"
        echo "  Resource: $MEDIA_RESOURCE"
        echo "  MIME Type: $MEDIA_MIME_TYPE"
        echo "  Size: $MEDIA_SIZE bytes"
        echo ""
    else
        echo "Response:"
        echo "$MEDIA_BODY" | head -20
        echo ""
        echo -e "${YELLOW}Install 'jq' for better JSON formatting${NC}"

        # Try to extract media resource without jq
        MEDIA_RESOURCE=$(echo "$MEDIA_BODY" | grep -o '"resource"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    fi

    if [ -z "$MEDIA_RESOURCE" ] || [ "$MEDIA_RESOURCE" = "null" ]; then
        echo -e "${RED}✗ Failed to extract media resource from response${NC}"
        exit 1
    fi

else
    echo -e "${RED}✗ Failed to upload media! (HTTP $HTTP_CODE)${NC}"
    echo "Response:"
    echo "$MEDIA_BODY"
    exit 1
fi

# Step 3: Create entry with media resource
echo -e "${BLUE}[Step 3/3] Creating entry with media resource...${NC}"

ENTRY_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X POST \
    "${DATASET_SERVICE_URL}/entries" \
    -H "Content-Type: application/vnd.api+json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -d "{
        \"data\": {
            \"type\": \"dataset:entries\",
            \"attributes\": {
                \"resource\": \"${MEDIA_RESOURCE}\",
                \"status\": \"pending\"
            },
            \"relationships\": {
                \"dataset\": {
                    \"data\": {
                        \"type\": \"datasets\",
                        \"id\": \"${DATASET_ID}\"
                    }
                }
            }
        }
    }")

HTTP_CODE=$(echo "$ENTRY_RESPONSE" | tail -n1)
ENTRY_BODY=$(echo "$ENTRY_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Entry created successfully!${NC}"
    echo ""

    if command -v jq &> /dev/null; then
        ENTRY_ID=$(echo "$ENTRY_BODY" | jq -r '.data.id')
        ENTRY_RESOURCE=$(echo "$ENTRY_BODY" | jq -r '.data.attributes.resource')
        ENTRY_STATUS=$(echo "$ENTRY_BODY" | jq -r '.data.attributes.status')
        CREATED_AT=$(echo "$ENTRY_BODY" | jq -r '.data.attributes.created_at')

        echo -e "${GREEN}Entry Details:${NC}"
        echo "  Entry ID: $ENTRY_ID"
        echo "  Resource: $ENTRY_RESOURCE"
        echo "  Status: $ENTRY_STATUS"
        echo "  Dataset ID: $DATASET_ID"
        echo "  Created At: $CREATED_AT"
        echo ""

        # Save entry ID for use in other scripts
        echo "$ENTRY_ID" > /tmp/idah_entry_id.txt
        echo -e "${GREEN}Entry ID saved to: /tmp/idah_entry_id.txt${NC}"

    else
        echo "Response:"
        echo "$ENTRY_BODY" | head -20
        echo ""
        echo -e "${YELLOW}Install 'jq' for better JSON formatting${NC}"

        # Try to extract entry ID without jq
        ENTRY_ID=$(echo "$ENTRY_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi

else
    echo -e "${RED}✗ Failed to create entry! (HTTP $HTTP_CODE)${NC}"
    echo "Response:"
    echo "$ENTRY_BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo "Successfully created an entry in dataset $DATASET_ID"
echo "  Media uploaded: $MEDIA_RESOURCE"
if [ -n "$ENTRY_ID" ] && [ "$ENTRY_ID" != "null" ]; then
    echo "  Entry ID: $ENTRY_ID"
fi
echo ""
echo -e "${GREEN}=== Next Steps ===${NC}"
echo "You can now:"
echo "  1. Create more entries by running this script again with different media files"
echo "  2. Annotate the entries in the IDAH web interface"
echo "  3. Export annotations using:"
echo "     $API_KEY $PROJECT_ID $DATASET_ID ./04_export_annotations.sh "

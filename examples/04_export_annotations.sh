#!/bin/bash

################################################################################
# IDAH API Example: Export Annotations and Download
################################################################################
#
# This script demonstrates how to:
# 1. Authenticate with an API key
# 2. Initiate an export job for dataset annotations
# 3. Poll for export completion
# 4. Download the exported file
#
# Usage:
#   IDAH_API_KEY="your_key" PROJECT_ID="123" DATASET_IDS="1,2,3" EXPORTER="Exports::Upd::Exporter" INCLUDE_MEDIAS="original" OUTPUT_DIR="/path/to/output" ./04_export_annotations.sh
#   or
#   ./04_export_annotations.sh your_key project_id dataset_ids [exporter] [include_medias] [output_dir]
#
# Optional Parameters:
#   - exporter: Export format class (default: Exports::Upd::Exporter)
#   - include_medias: Media inclusion option - "original", "thumbnail", "none", or any custom value (default: original)
#   - output_dir: Directory where the exported file will be saved (default: current directory)
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
SYNC_SERVICE_URL="${SYNC_SERVICE_URL:-${IDAH_URL}/api/v1/sync}"
API_KEY="${1:-$IDAH_API_KEY}"
PROJECT_ID="${2:-$PROJECT_ID}"
DATASET_IDS="${3:-$DATASET_IDS}"
EXPORTER="${4:-${EXPORTER:-Exports::Upd::Exporter}}"  # Default exporter format
INCLUDE_MEDIAS="${5:-${INCLUDE_MEDIAS:-original}}"  # Default to "original" (options: original, thumbnail, none, etc.)
OUTPUT_DIR="${6:-${OUTPUT_DIR:-.}}"  # Default to current directory
MAX_POLL_ATTEMPTS="${MAX_POLL_ATTEMPTS:-60}"  # Maximum polling attempts (60 * 5 = 5 minutes)
POLL_INTERVAL=5  # Poll every 5 seconds

# Detect localhost and set curl insecure flag if needed
if [[ "$IDAH_URL" =~ localhost ]]; then
    CURL_INSECURE="-k"
else
    CURL_INSECURE=""
fi

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: API key not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" DATASET_IDS=\"1,2,3\" $0"
    echo "   or: $0 your_key project_id dataset_ids [exporter] [include_medias] [output_dir]"
    exit 1
fi

# Check if project ID is provided
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: Project ID not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" DATASET_IDS=\"1,2,3\" $0"
    echo "   or: $0 your_key project_id dataset_ids [exporter] [include_medias] [output_dir]"
    exit 1
fi

# Check if dataset IDs are provided
if [ -z "$DATASET_IDS" ]; then
    echo -e "${RED}Error: Dataset IDs not provided${NC}"
    echo "Usage: IDAH_API_KEY=\"your_key\" PROJECT_ID=\"project_id\" DATASET_IDS=\"1,2,3\" $0"
    echo "   or: $0 your_key project_id dataset_ids [exporter] [include_medias] [output_dir]"
    exit 1
fi

# Convert comma-separated dataset IDs to JSON array
# IFS=',' read -ra DATASET_ARRAY <<< "$DATASET_IDS"
# DATASET_JSON="["
# for i in "${!DATASET_ARRAY[@]}"; do
#     if [ $i -gt 0 ]; then
#         DATASET_JSON+=","
#     fi
#     DATASET_JSON+="\"${DATASET_ARRAY[$i]}\""
# done
# DATASET_JSON+="]"

IFS=',' read -ra DATASET_ARRAY <<< "$DATASET_IDS"
DATASET_JSON="["
for i in "${!DATASET_ARRAY[@]}"; do
    if [ $i -gt 0 ]; then
        DATASET_JSON+=","
    fi
    VALUE=$(echo "${DATASET_ARRAY[$i]}" | xargs)  # trim spaces
    DATASET_JSON+="\"$VALUE\""
done
DATASET_JSON+="]"

echo -e "${GREEN}=== IDAH API: Export Annotations ===${NC}"
echo "IDAH URL: $IDAH_URL"
echo "IAM Service URL: $IAM_SERVICE_URL"
echo "Sync Service URL: $SYNC_SERVICE_URL"
echo "Project ID: $PROJECT_ID"
echo "Dataset IDs: $DATASET_IDS"
echo "Exporter: $EXPORTER"
echo "Include Medias: $INCLUDE_MEDIAS"
echo "Output Directory: $OUTPUT_DIR"
echo ""

# Step 1: Authenticate and get token
echo -e "${BLUE}[Step 1/4] Authenticating with API key...${NC}"
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

# Step 2: Initiate export job
echo -e "${BLUE}[Step 2/4] Initiating export job...${NC}"

EXPORT_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X POST \
  "${SYNC_SERVICE_URL}/exports/export" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "{
      \"project_id\": \"${PROJECT_ID}\",
      \"dataset_ids\": ${DATASET_JSON},
      \"exporter\": \"${EXPORTER}\",
      \"options\": {
          \"include_medias\": \"${INCLUDE_MEDIAS}\"
      }
  }")

HTTP_CODE=$(echo "$EXPORT_RESPONSE" | tail -n1)
EXPORT_BODY=$(echo "$EXPORT_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -ne 200 ] && [ "$HTTP_CODE" -ne 201 ]; then
    echo -e "${RED}✗ Failed to initiate export job! (HTTP $HTTP_CODE)${NC}"
    echo "Response:"
    echo "$EXPORT_BODY"
    exit 1
fi

echo -e "${GREEN}✓ Export job initiated${NC}"

# Extract export/job ID
if command -v jq &> /dev/null; then
    EXPORT_ID=$(echo "$EXPORT_BODY" | jq -r '.data.id // .id // empty')
else
    EXPORT_ID=$(echo "$EXPORT_BODY" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$EXPORT_ID" ] || [ "$EXPORT_ID" = "null" ]; then
    echo -e "${RED}✗ Failed to extract export ID from response${NC}"
    echo "Response:"
    echo "$EXPORT_BODY"
    exit 1
fi

echo "Export ID: $EXPORT_ID"
echo ""

# Step 3: Poll for export completion
echo -e "${BLUE}[Step 3/4] Waiting for export to complete...${NC}"
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_POLL_ATTEMPTS ]; do
    sleep $POLL_INTERVAL
    ATTEMPT=$((ATTEMPT + 1))

    # Check export status
    EXPORT_JOB_RESPONSE=$(curl -s $CURL_INSECURE -X GET \
        "${SYNC_SERVICE_URL}/exports/${EXPORT_ID}" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")

    HTTP_CODE_JOB=$(echo "$EXPORT_JOB_RESPONSE" | tail -n1)
    JOB_BODY=$(echo "$EXPORT_JOB_RESPONSE" | sed '$d')

    if command -v jq &> /dev/null; then
        EXPORT_JOB_ID=$(echo "$JOB_BODY" | jq -r '.data.attributes.job_id // empty')
    else
        EXPORT_JOB_ID=$(echo "$JOB_BODY" | grep -o '"job_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    fi

    STATUS_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X GET \
        "${SYNC_SERVICE_URL}/jobs/${EXPORT_JOB_ID}" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")


    HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
    STATUS_BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -ne 200 ]; then
        echo -e "${YELLOW}Warning: Status check failed (HTTP $HTTP_CODE)${NC}"
        continue
    fi

    if command -v jq &> /dev/null; then
        JOB_STATUS=$(echo "$STATUS_BODY" | jq -r '.data.attributes.status')
        JOB_PROGRESS=$(echo "$STATUS_BODY" | jq -r '.data.attributes.progress')
    else
        JOB_STATUS=$(echo "$STATUS_BODY" | grep -o '"status"\s*:\s*"[^"]*"' | tail -1 | cut -d'"' -f4)
        JOB_PROGRESS=$(echo "$STATUS_BODY" | grep -o '"progress":[^,}]*' | tail -1 | cut -d':' -f2 | tr -d ' ')
    fi

    PROGRESS=$(echo "$JOB_PROGRESS" | awk '{printf "%.0f", $1*100}')

    echo -e "${YELLOW}[Attempt $ATTEMPT/$MAX_POLL_ATTEMPTS] Status: $JOB_STATUS, Progress: ${PROGRESS}%${NC}"

    if [ "$JOB_STATUS" = "completed" ]; then
        echo -e "${GREEN}✓ Export completed successfully!${NC}"
        break
    elif [ "$JOB_STATUS" = "failed" ] || [ "$JOB_STATUS" = "errored" ]; then
        echo -e "${RED}✗ Export job failed!${NC}"
        echo "Job Status Response: $STATUS_BODY"
        exit 1
    fi
done

if [ $ATTEMPT -ge $MAX_POLL_ATTEMPTS ]; then
    echo -e "${RED}✗ Export job did not complete within the timeout period${NC}"
    echo "Last status: $JOB_STATUS"
    exit 1
fi

echo ""

# Step 4: Download the export file
echo -e "${BLUE}[Step 4/4] Downloading export file...${NC}"

# Extract filename if available
if command -v jq &> /dev/null; then
    FILENAME=$(echo "$STATUS_BODY" | jq -r '.data.attributes.filename // "export.zip"')
else
    FILENAME="export_${EXPORT_ID}.zip"
fi

OUTPUT_FILE="${OUTPUT_DIR}/${FILENAME}"

echo "Downloading to: $OUTPUT_FILE"

DOWNLOAD_RESPONSE=$(curl -s $CURL_INSECURE -w "\n%{http_code}" -X GET \
    "${SYNC_SERVICE_URL}/exports/${EXPORT_ID}/download" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -o "$OUTPUT_FILE")

HTTP_CODE=$(echo "$DOWNLOAD_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 200 ]; then
    FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Export file downloaded successfully!${NC}"
    echo ""
    echo -e "${GREEN}Export Details:${NC}"
    echo "  Export ID: $EXPORT_ID"
    echo "  File: $OUTPUT_FILE"
    echo "  Size: $FILE_SIZE bytes"
    echo ""
    echo -e "${GREEN}=== Complete ===${NC}"
    echo "Your annotations have been exported and downloaded."
else
    echo -e "${RED}✗ Failed to download export file! (HTTP $HTTP_CODE)${NC}"
    # Show file content if it's an error message
    if [ -f "$OUTPUT_FILE" ]; then
        head -20 "$OUTPUT_FILE"
        rm "$OUTPUT_FILE"
    fi
    exit 1
fi

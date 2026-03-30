# IDAH API Examples

This directory contains example shell scripts demonstrating how to use the IDAH API with API keys.

## Prerequisites

- `curl` command-line tool
- `jq` for JSON parsing (optional, but recommended)
- A valid IDAH API key (format: `IDAH_...` with 69 characters)

## Getting Started

### 1. Set Your API Configuration

Before running any scripts, set the following environment variables or edit them directly in the scripts:

```bash
export IDAH_API_KEY="IDAH_your_api_key_here"
export IDAH_URL="https://idah.localhost:8443"  # Base IDAH URL
```

**For different environments:**

```bash
# Local development
export IDAH_URL="https://idah.localhost:8443"

# Staging / Production
export IDAH_URL="https://idah.ingedata.ai"

```

**Note:** The scripts will automatically construct the service URLs (IAM, Dataset, Sync) from the base IDAH_URL. For localhost URLs, SSL certificate verification is automatically disabled.

### 2. Available Scripts

- **`01_authenticate.sh`** - Authenticate with API key and get JWT token
- **`02_create_project.sh`** - Create a new project using the dataset service
- **`03_create_dataset.sh`** - Create a dataset and import entries
- **`04_export_annotations.sh`** - Export annotations and download the result

### 3. Running the Examples

Each script can be run independently:

```bash
# Make scripts executable
chmod +x examples/*.sh

# Run authentication example
./examples/01_authenticate.sh

# Create a project (requires organization_id)
./examples/02_create_project.sh

# Create a dataset (requires project_id)
./examples/03_create_dataset.sh

# Create entries in one dataset (requires project_id , dataset_id and media file)
./examples/03_create_entries.sh

# Export annotations (requires project_id and dataset_ids)
./examples/04_export_annotations.sh
```

## Script Details

### 01_authenticate.sh

Authenticates using an API key and retrieves a JWT token that can be used for subsequent API calls.

**Input:**

- API key (via environment variable or script argument)

**Output:**

- JWT auth token
- Token expiration time

### 02_create_project.sh

Creates a new project in the specified organization.

**Input:**

- API key
- Organization ID
- Project name (optional, defaults to "API Test Project")

**Output:**

- Created project details including project ID

### 03_create_dataset.sh

Creates a new dataset and optionally imports entries into it.

**Input:**

- API key
- Project ID
- Dataset name
- Modality (e.g., "image", "video", "text")

**Output:**

- Created dataset details including dataset ID

### 03_create_entries.sh

Import a media file and create new dataset entries.

**Input:**

- API key
- Project ID
- Dataset ID
- Media file path

**Output:**

- Created entries details including entry ID

### 04_export_annotations.sh

Exports annotations from specified datasets and downloads the export file.

**Input:**

- API key
- Project ID
- Dataset IDs (comma-separated)
- Export format/exporter name

**Output:**

- Export job ID
- Downloaded export file

## API Endpoints Reference

### IAM Service

- `POST /auth/api/login` - Authenticate with API key

### Dataset Service

- `POST /projects` - Create a new project
- `GET /projects` - List projects
- `POST /datasets` - Create a new dataset
- `GET /datasets` - List datasets
- `POST /entries` - Create entries in a dataset

### Sync Service

- `POST /exports/export` - Initiate an export job
- `GET /exports/:id` - Get export job status
- `GET /exports/:id/download` - Download completed export

## Notes

- All authenticated requests require the `Authorization: Bearer <token>` header
- The JWT token from authentication has a default expiration of 1 hour (3600 seconds)
- API keys must have appropriate permissions for the operations you want to perform
- Service URLs may vary depending on your deployment configuration

## Troubleshooting

### "Invalid Key" Error

- Ensure your API key is in the correct format (starts with `IDAH_` and is 69 characters long)
- Verify the API key hasn't been revoked or expired

### "Authorization" Error

- Check that your API key has the necessary permissions
- Ensure you're using the correct JWT token in the Authorization header

### Connection Refused

- Verify the service URLs are correct for your environment
- Ensure all required services are running

## Support

For more information, refer to the main IDAH documentation or contact your system administrator.

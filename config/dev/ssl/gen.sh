#!/bin/bash

# Set pwd to directory of this script:
cd "$(dirname "$0")"

# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate signing request
openssl req -new -key key.pem -out cert.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=idah.localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in cert.csr -signkey key.pem -out cert.pem

# Clean up CSR file
rm cert.csr

echo "SSL certificates generated successfully!"
echo "Certificate: cert.pem"
echo "Private key: key.pem"
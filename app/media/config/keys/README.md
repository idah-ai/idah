This folder should be mounted in the container to a secret file
called ./config/keys/secret.pem

This key is used to generate the JWT token and should not be shared.
The existing key is an example and should not be used in production but
only in development and test environments.

PRODUCTION KEY MUST NOT BE STORED IN THE GIT REPOSITORY
This folder should be mounted in the container to a secret file
called ./config/keys/secret.pem

This key is used to generate the JWT token and should not be shared.
The existing key is an example and should not be used in production but
only in development and test environments.

PRODUCTION KEY MUST NOT BE STORED IN THE GIT REPOSITORY

## SERVICE_JWT_KEY

The signing key is read from the `SERVICE_JWT_KEY` environment variable
(see `config/initializers/set_keys.rb`). It accepts one of two forms:

- A raw PEM string (the key content itself), or
- `file:/absolute/path/to/key.pem` — the `file:` prefix is required for
  the value to be read from a file.

A bare filesystem path **without** the `file:` prefix is treated as key
content and fails at parse time with an opaque OpenSSL error. Always
prefix a path with `file:`.

The key may be public or private: a public key can validate tokens but
cannot forge (sign) new ones.
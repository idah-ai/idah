# Security Policy

## Overview

Security is a top priority for the IDAH project. This document outlines our security policies and best practices for contributors and users.

---

## 🔒 Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ Yes             |
| < 1.0   | ⚠️ Best effort     |

---

##  Security Best Practices

### For Users & Deployers

#### ⚠️ Development vs Production

**The default development configuration is NOT secure for production use.**

**Development Defaults (DO NOT USE IN PRODUCTION):**
```
Database: postgres:postgres
Admin: admin@idah.ai / P@ssword01
JWT Keys: Committed dev keys
SSL: Self-signed certificates
```

#### ✅ Production Deployment Checklist

Before deploying IDAH to production:

- [ ] **Generate Strong Credentials**
  - Database passwords (minimum 32 characters, random)
  - Admin passwords (enforce strong password policy)
  - API keys and tokens

- [ ] **Generate New Cryptographic Keys**
  - JWT signing keys (use strong random keys)
  - Session secrets
  - Encryption keys

- [ ] **Secure SSL/TLS**
  - Use certificates from trusted CA
  - Enable HTTPS only
  - Configure HSTS headers

- [ ] **Environment Variables**
  - Never commit `.env` files with production secrets
  - Use secure secret management (AWS Secrets Manager, HashiCorp Vault, etc.)
  - Rotate secrets regularly

- [ ] **Database Security**
  - Use strong passwords
  - Enable SSL/TLS for database connections
  - Restrict network access
  - Regular backups

- [ ] **Application Security**
  - Keep dependencies updated
  - Enable rate limiting
  - Configure CORS properly
  - Enable audit logging

- [ ] **Infrastructure**
  - Use firewalls and security groups
  - Enable monitoring and alerting
  - Regular security updates
  - Backup strategy

#### Environment Variables Security

**Never commit these to git:**
- `*.pem` files (except dev keys)
- `.env` files (except `.env.example`)
- `config/keys/private.*.pem` (production/staging keys)
- Database credentials
- API keys and tokens

**Always use:**
- Environment-specific configuration
- Secret management systems
- Encrypted storage for sensitive data

### For Contributors

#### Code Security Guidelines

1. **Authentication & Authorization**
   - Always validate user permissions
   - Use the built-in IAM service
   - Never trust client-side data

2. **Input Validation**
   - Validate all user inputs
   - Use parameterized queries (prevent SQL injection)
   - Sanitize data before rendering (prevent XSS)

3. **Secrets Management**
   - Never hardcode secrets
   - Use environment variables
   - Add sensitive patterns to `.gitignore`

4. **Dependencies**
   - Keep dependencies updated
   - Review security advisories
   - Use `bundle audit` for Ruby gems
   - Use `npm audit` for Node packages

5. **Error Handling**
   - Don't expose stack traces in production
   - Log errors securely
   - Use appropriate error messages

#### Pre-commit Checks

Before committing code:

```bash
# Check for accidentally committed secrets
git diff --cached | grep -i "password\|secret\|key\|token"

# Ruby security audit
cd app/iam && bundle audit check --update

# JavaScript security audit
cd app/frontend && npm audit

# Check .gitignore coverage
git status --ignored
```

---

## 🛡️ Security Features

IDAH includes several built-in security features:

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Session management
- Password hashing with BCrypt

### Audit Logging
- All user actions logged
- Immutable audit trail
- Compliance tracking

### Data Protection
- Encrypted database connections
- Secure file storage
- Data validation and sanitization

### API Security
- Rate limiting
- CORS configuration
- Authentication required for all endpoints
- Input validation

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)

---

## 📞 Contact

- **General Support:** [GitHub Issues](https://github.com/idah-ai/idah/issues)
- **Documentation:** [docs.idah.ai](https://docs.idah.ai)

---

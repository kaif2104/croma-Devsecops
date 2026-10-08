# ShopZone - Smartphone and Laptop store (React + Node/Express + PostgreSQL)

40 products (20 smartphones, 20 laptops) with generated SVG product images.

## Run
    cp .env.example .env     # then edit secrets
    docker compose up --build
    open http://localhost:8080

If port 8080 is already in use, set `FRONTEND_PORT` in `.env` (for example, `FRONTEND_PORT=8081`) and open the matching port instead.

## Local dev (no Docker)
    # create a Postgres DB and run db/init.sql
    cd backend && npm install && DATABASE_URL=postgres://user:pass@localhost:5432/shopzone JWT_SECRET=longsecret npm start
    cd frontend && npm install && npm run dev      # http://localhost:5173

## Change the catalog
Edit generate_data.py and run `python3 generate_data.py` (rewrites db/init.sql and frontend/public/img/*.svg).
To use real photos, drop files into frontend/public/img/ and update the image column.

## API
GET /api/products | POST /api/register | POST /api/login | POST /api/orders (auth) | GET /api/orders (auth) | GET /api/health

## DevSecOps practice ideas
- Secrets scan: gitleaks, trufflehog | SAST: Semgrep, CodeQL | SCA: npm audit, Trivy fs, Dependabot
- Container scan: Trivy image, Grype, Hadolint | SBOM: Syft | DAST: OWASP ZAP baseline on http://localhost:8080
- CI/CD: GitHub Actions or GitLab CI (lint, test, scan, build, push) | IaC: Checkov, Kubernetes + Kyverno/OPA, Falco
- Hardening TODOs: helmet + rate limiting on /login, restrict CORS, JWT in httpOnly cookie + CSRF, nginx security headers (CSP, HSTS),
  pin image digests, non-root nginx, read-only FS, DB least-privilege role, TLS to DB, audit logging, tests
- Already done well (verify with tools): parameterized SQL, server-side price calculation, stock locking in a transaction, bcrypt hashing

# COTY Backend

Node.js/Express API for the COTY judging app.

## Run locally

```bash
npm install
npm start
```

Default local URL:

```text
http://localhost:4000
```

Health endpoint:

```text
http://localhost:4000/api/health
```

## Environment variables

Create a local `.env` file from `.env.example`:

```env
MONGO_URI=your_mongodb_connection_string_here
PORT=4000
JWT_SECRET=replace_with_secure_secret_later
FRONTEND_URL=http://localhost:3000
```

## Important files

```text
server.js                 Express server setup
routes/api.js             API routes, auth, validation and CRUD logic
models/                   Mongoose schemas
scripts/hashExistingPasswords.js
```

## Password migration

Existing plain-text judge passwords can be migrated to bcrypt hashes with:

```bash
node scripts/hashExistingPasswords.js
```

The login route temporarily supports both bcrypt hashes and legacy plain text values, but new/updated passwords are saved as bcrypt hashes.

## Security behavior

- Login endpoint: `POST /api/auth/login`
- Login returns a JWT token.
- Admin write/delete routes require an admin JWT.
- Review submission requires a logged-in JWT.
- `/api/judges` excludes password values.

## Smoke checks

With the backend running:

```bash
curl http://localhost:4000/
curl http://localhost:4000/api/health
curl http://localhost:4000/api/judges
```

A protected request without token should return `401`:

```bash
curl -X POST http://localhost:4000/api/competitors \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","category":"Under 2 years"}'
```

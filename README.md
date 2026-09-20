# PAE Quiz Platform

PAE is an interactive quiz platform for creating quizzes, publishing them to a marketplace, and hosting real-time multiplayer games. Students can join with a game PIN without creating an account.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Go
- Data and services: MongoDB, Redis, MQTT, Gemini, Razorpay

## Project structure

```text
backend/    Go API server
frontend/   React application
render.yaml Render deployment configuration
```

## Requirements

- Node.js 18+
- Go 1.21+
- MongoDB
- Redis

## Backend setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in the required database, authentication, and service credentials.
3. Start the API:

```powershell
cd backend
go run ./cmd/api
```

The backend runs on `http://localhost:8080` by default.

## Frontend setup

Install dependencies and start the development server:

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

The frontend environment files configure the API endpoint:

```text
VITE_API_URL=https://pae-o48s.onrender.com/api
```

Use a local API during development by changing `frontend/.env.development` to:

```text
VITE_API_URL=http://localhost:8080/api
```

Restart Vite after changing environment variables.

## Production build

```powershell
cd frontend
npm run build
```

The generated files are written to `frontend/dist`.

## CI/CD

GitHub Actions runs on pull requests and pushes to `main`:

- Installs and builds the frontend.
- Formats, tests, vets, and builds the backend.
- On successful pushes to `main`, optionally triggers deployments.

To enable deployment triggers, add these repository secrets:

- `RENDER_DEPLOY_HOOK` — Render deploy-hook URL for the backend.
- `NETLIFY_BUILD_HOOK` — Netlify build-hook URL for the frontend.

If the hooks are not configured, CI still runs all validation checks and skips deployment.

## Main routes

- `/` — Landing page
- `/login` and `/register` — Authentication
- `/dashboard` — Teacher and student dashboard
- `/quiz/create` — Quiz creation
- `/marketplace` — Public quiz marketplace
- `/join` — Join a game with a PIN
- `/docs` — User documentation

## Security

Do not commit `.env` files, credentials, service-account files, API keys, or production secrets. Use `backend/.env.example` only as a configuration reference.

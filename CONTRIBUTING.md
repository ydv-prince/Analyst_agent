# Contributing to Analyst Agent

Thank you for your interest in contributing to Analyst Agent. Please review this guide to understand our repository architecture, branching policy, and quality standards.

---

## 1. Branch Strategy & Release Isolation

The repository maintains strict isolation between stable release baselines and ongoing development lines:

- **`main`:** Contains the accepted, stable `v1.0.0` release baseline. Pinned to tag `v1.0.0`.
- **`v2`:** Active development branch for the v2.0.0 Production Edition (introducing multi-user authentication, Bring Your Own Key vault, and multi-provider adapters).
- **`v1.0.0-polish`:** Dedicated maintenance branch for v1 documentation, repository quality, and presentation improvements.

### Strict Isolation Rules
1. Never merge work from `v2` into `main` or `v1.0.0-polish`.
2. Never rewrite Git history, force-push (`git push --force`), or delete release tags.
3. The release tag `v1.0.0` is immutable.
4. Never commit `.env`, credentials, database connection strings, or secrets.

---

## 2. Local Development Setup

### Prerequisites
- Node.js (v20+ or v24 LTS recommended)
- npm (v10+)
- MongoDB Atlas cluster URI or local MongoDB daemon

### Installation
Clone the repository and install dependencies for both workspaces:

```powershell
# Clone repository
git clone https://github.com/ydv-prince/Analyst_agent.git
cd Analyst_agent

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

### Environment Configuration
Copy the sample environment file in `server/`:

```powershell
cp server/.env.example server/.env
```

Edit `server/.env` with your values:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/analyst_agent
MISTRAL_API_KEY=your_mistral_api_key_here
```

### Running Locally
Run the backend and frontend in separate terminals:

```powershell
# Terminal 1: Backend API
npm run server

# Terminal 2: Frontend Client
npm run client
```

Access the frontend application at `http://localhost:5173/`.

---

## 3. Testing & Verification

All contributions must pass the automated test suites prior to submitting a pull request:

```powershell
# Run the complete test suite (backend and client integration)
npm test

# Run backend tests only
npm run test:server

# Run client tests only
npm run test:client

# Run frontend production build
npm run build
```

---

## 4. Coding Standards

- **JavaScript Modules:** Use standard ES Modules (`import`/`export`) across both client and server.
- **Styling:** Adhere to Tailwind utility classes conforming to the dark theme palette in `tailwind.config.js`.
- **Zero Third-Party Router Bloat:** Maintain navigation state through `AgentContext.jsx` with browser History API synchronization.
- **Error Handling:** Standardize API responses using the centralized error handler and sanitize credentials from error messages.


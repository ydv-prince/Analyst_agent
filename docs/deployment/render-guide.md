# Deployment Guide — Render Free Tier

This guide documents the target deployment architecture for hosting Analyst Agent on Render's free tier. 

> **Verification Notice:** Local runtime execution and automated builds have been verified on Windows Node.js v24. Cloud deployment to Render is documented here as a deployment blueprint and requires configuring live service credentials.

---

## 1. Architecture Overview

The application deploys as two decoupled services:
1. **Backend Web Service (Node.js/Express):** Runs the API server, manages MongoDB connection pools, and proxies Mistral AI API calls.
2. **Frontend Static Site (Vite/React):** Serves the pre-compiled static SPA bundle (`client/dist`).

---

## 2. Backend Web Service Configuration

1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect your GitHub repository (`ydv-prince/Analyst_agent`).
3. Set service properties:
   - **Name:** `analyst-agent-server`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Instance Type:** `Free`
4. Configure **Environment Variables**:
   | Variable | Value / Description |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (Render default) |
   | `CLIENT_URL` | `https://analyst-agent-client.onrender.com` (Your frontend URL) |
   | `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster.mongodb.net/analyst_agent` |
   | `MISTRAL_API_KEY` | Your Mistral AI API key |
5. **Health Check Path:** Set to `/api/health`.

---

## 3. Frontend Static Site Configuration

1. In Render Dashboard, click **New +** > **Static Site**.
2. Connect the same repository.
3. Set properties:
   - **Name:** `analyst-agent-client`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Configure **Rewrites and Redirects**:
   - Add a rewrite rule for API proxying:
     - **Source:** `/api/*`
     - **Destination:** `https://analyst-agent-server.onrender.com/api/*`
     - **Action:** `Rewrite`
   - Add a SPA fallback rule:
     - **Source:** `/*`
     - **Destination:** `/index.html`
     - **Action:** `Rewrite`

---

## 4. MongoDB Atlas Network Configuration

1. In MongoDB Atlas, navigate to **Security** > **Network Access**.
2. Add an IP Access Entry:
   - For Render's dynamically allocated outgoing IPs on the free tier, allow `0.0.0.0/0` (Allow access from anywhere).
   - Ensure the database user has Read and Write permissions on the `analyst_agent` database.

---

## 5. Free-Tier Considerations & Cold Starts

- **Spin Down on Idle:** Free Web Services on Render spin down after 15 minutes of inactivity. The first incoming request after idle may experience a 30–50 second cold-start delay while the container boots and establishes the MongoDB Atlas connection.
- **Circuit Breaker Behavior:** During bootup, if the database connection takes a few seconds, the backend `requireDatabase` middleware returns HTTP 503 until connection state is active (`readyState === 1`).


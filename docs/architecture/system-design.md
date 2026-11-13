# System Architecture & Design — Analyst Agent v1.0.0

## 1. Overview

Analyst Agent v1.0.0 is an interactive AI-assisted data analysis application built on the MERN stack (MongoDB, Express, React, Node.js). The architecture decouples the frontend client from backend API operations and isolates third-party AI provider communication entirely within the Express service layer.

```mermaid
graph TD
    User([User / Browser])
    
    subgraph Frontend ["Client Layer (React 18 + Vite)"]
        UI[AppRouter / Views<br>HomePage / ChatPage / SettingsPage]
        Context[AgentContext<br>State Store & History Navigation]
        APIClient[API Service Client<br>Fetch /api Proxy]
        UI --> Context
        Context --> APIClient
    end

    subgraph Backend ["Server Layer (Node.js + Express 4)"]
        Server[Express App / Router]
        Middleware[Middleware<br>CORS / dbCheck / errorHandler]
        SessionCtrl[Session Controller]
        ChatCtrl[Chat Controller]
        MistralSvc[Mistral Service]
        
        Server --> Middleware
        Middleware --> SessionCtrl
        Middleware --> ChatCtrl
        ChatCtrl --> MistralSvc
    end

    subgraph Persistence ["Database Layer (MongoDB Atlas)"]
        Mongo[(MongoDB Atlas<br>Sessions & Messages Collections)]
        SessionCtrl --> Mongo
        ChatCtrl --> Mongo
    end

    subgraph External ["AI Provider Layer (Mistral AI)"]
        MistralAPI[Mistral AI REST API<br>https://api.mistral.ai/v1/chat/completions]
        MistralSvc --> MistralAPI
    end

    User <--> UI
    APIClient <--> Server
```

---

## 2. Frontend / Backend Separation

### Client Architecture
- **Single Page Application:** React 18 powered by Vite.
- **Styling:** Tailwind CSS with a unified dark theme palette (`#0F172A` scaffold, `#1E293B` cards, `#6366F1` indigo primary, `#EC4899` pink secondary).
- **Navigation:** Stack-based routing managed in `AgentContext.jsx` synchronized with the browser's History API (`window.history.pushState` and `window.onpopstate`). This eliminates third-party routing dependencies while supporting natural browser back/forward navigation.
- **Markdown Processing:** Zero-dependency regex tokenizer (`MarkdownRenderer.jsx`) that parses headers, bold, italics, lists, blockquotes, inline code, and syntax blocks.

### Backend Architecture
- **RESTful API:** Express 4 server configured with JSON body parsing (1MB limit) and strict CORS origins.
- **Decoupled AI Communication:** The client never communicates with Mistral AI directly. All API keys, prompt templating, and provider interactions are encapsulated within the server.
- **Database Circuit Breaker:** `requireDatabase` middleware intercepts state-changing requests, returning HTTP 503 (`DATABASE_UNAVAILABLE`) if the MongoDB connection drops.

---

## 3. Request & Inference Lifecycle

The backend coordinates message persistence and external LLM inference in a fault-tolerant multi-step sequence.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as React Client (ChatPage)
    participant Server as Express Server (chatController)
    participant DB as MongoDB Atlas (Messages)
    participant AI as Mistral AI API

    User->>Client: Types analysis prompt & presses Send
    Client->>Client: Optimistically renders user message
    Client->>Server: POST /api/chat/completions { sessionId, content }
    Server->>Server: Validate sessionId (ObjectId) & content (non-empty)
    Server->>DB: Verify Session exists
    Server->>DB: Persist User Message (role: 'user')
    Server->>DB: Fetch chronological conversation history
    DB-->>Server: Return ordered message array
    Server->>Server: Sanitize history & prepend trusted SYSTEM_PROMPT
    Server->>AI: POST /v1/chat/completions { model, messages, max_tokens: 4096 }
    
    alt Inference Successful
        AI-->>Server: HTTP 200 { choices: [{ message: { content } }] }
        Server->>DB: Persist Assistant Message (role: 'assistant', isError: false)
        Server-->>Client: HTTP 200 { id, sessionId, content, role: 'assistant', isError: false }
        Client->>Client: Replace pending indicator with assistant bubble
    else Upstream Provider Error (e.g. 401, 429, 502)
        AI-->>Server: HTTP Error (status & error message)
        Server->>DB: Persist Error Bubble (role: 'assistant', isError: true)
        Server-->>Client: HTTP 502/429 { error: { code, message }, message: errorDoc }
        Client->>Client: Render error message bubble in stream
    end
```

---

## 4. Data Modeling & Persistence

The persistence layer uses Mongoose schemas mapped to two primary collections in MongoDB:

### Session Schema (`server/src/models/Session.js`)
Represents an isolated conversational data analysis session.

```javascript
{
  agentName: { type: String, default: 'Data analyst', trim: true },
  model: { type: String, default: 'mistral-large-latest', trim: true },
  createdAt: { type: Date, default: Date.now },
  environmentId: { type: String, default: null },
  datasetPath: { type: String, default: null },
  datasetSummary: { type: String, default: null }
}
```

- **Serialization:** Custom `toJSON` transform projects `_id` into a string `id` property for frontend consistency.

### Message Schema (`server/src/models/Message.js`)
Represents individual conversational turns within a session.

```javascript
{
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  content: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  timestamp: { type: Date, default: Date.now },
  attachments: { type: [String], default: [] },
  isError: { type: Boolean, default: false }
}
```

- **Indexes:**
  - Single index: `{ sessionId: 1 }`
  - Compound index: `{ sessionId: 1, timestamp: 1 }` for ordered retrieval during history loading.

---

## 5. Security & Error Handling

1. **Zero Credential Exposure:** `MISTRAL_API_KEY` is loaded solely through backend environment variables (`server/.env`). The client bundle contains zero references to API keys.
2. **Error Message Redaction:** The centralized Express error handler (`errorHandler.js`) strips any Bearer token patterns before transmitting error payloads to clients.
3. **Prompt Injection Mitigation:** `mistralService.js` filters incoming conversation history so that only messages with roles `'user'` and `'assistant'` are forwarded upstream. Client-supplied system prompts are discarded, and the trusted backend `SYSTEM_PROMPT` is enforced at the head of every request.
4. **Resilient Timeouts:** Upstream inference requests use `AbortSignal.timeout(60000)` to prevent hanging sockets during network degradation.


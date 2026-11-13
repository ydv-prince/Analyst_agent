# API Reference — Analyst Agent v1.0.0

Base URL: `http://localhost:5000/api` (or configured deployment host)

All request and response bodies use JSON formatting (`Content-Type: application/json`).

---

## 1. System Health

### `GET /api/health`
Inspects runtime service health, database connectivity status, and AI provider configuration.

#### Request
- **Headers:** None required
- **Parameters:** None

#### Response (`200 OK`)
```json
{
  "status": "ok",
  "timestamp": "2026-11-13T01:15:00.000Z",
  "service": "AI-Assisted Data Analysis Agent Backend",
  "version": "1.0.0",
  "database": {
    "status": "connected",
    "connected": true
  },
  "mistral": {
    "configured": true
  }
}
```

---

## 2. Session Management

### `POST /api/sessions`
Initializes a new analysis session entity in MongoDB.

#### Request Body (Optional)
```json
{
  "agentName": "Data Analyst",
  "model": "mistral-large-latest"
}
```

#### Response (`201 Created`)
```json
{
  "id": "6733f1122a1b9c0012e84511",
  "agentName": "Data Analyst",
  "model": "mistral-large-latest",
  "createdAt": "2026-11-13T01:15:10.000Z",
  "environmentId": null,
  "datasetPath": null,
  "datasetSummary": null
}
```

---

### `GET /api/sessions/:id`
Retrieves a specific session metadata object and its full chronological message history.

#### Path Parameters
- `id` (string, required): A valid 24-character hexadecimal MongoDB ObjectId.

#### Error Responses
- `400 Bad Request` if `id` is not a valid ObjectId:
  ```json
  {
    "error": {
      "code": "INVALID_SESSION_ID",
      "message": "The provided session ID is not a valid MongoDB ObjectId."
    }
  }
  ```
- `404 Not Found` if session does not exist:
  ```json
  {
    "error": {
      "code": "SESSION_NOT_FOUND",
      "message": "Session with ID '6733f1122a1b9c0012e84511' was not found."
    }
  }
  ```

#### Success Response (`200 OK`)
```json
{
  "session": {
    "id": "6733f1122a1b9c0012e84511",
    "agentName": "Data Analyst",
    "model": "mistral-large-latest",
    "createdAt": "2026-11-13T01:15:10.000Z"
  },
  "messages": [
    {
      "id": "6733f1202a1b9c0012e84512",
      "sessionId": "6733f1122a1b9c0012e84511",
      "content": "What are the key statistics of this dataset?",
      "role": "user",
      "timestamp": "2026-11-13T01:15:15.000Z",
      "attachments": [],
      "isError": false
    },
    {
      "id": "6733f1242a1b9c0012e84513",
      "sessionId": "6733f1122a1b9c0012e84511",
      "content": "To evaluate your dataset, examine the central tendency and dispersion...",
      "role": "assistant",
      "timestamp": "2026-11-13T01:15:18.000Z",
      "attachments": [],
      "isError": false
    }
  ]
}
```

---

### `DELETE /api/sessions/:id/messages`
Purges conversation history for the given session while preserving the session metadata.

#### Path Parameters
- `id` (string, required): MongoDB ObjectId of the target session.

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Conversation history cleared successfully.",
  "clearedCount": 4
}
```

---

## 3. Chat & AI Completions

### `POST /api/chat/completions`
Dispatches a user query to the AI completion service, preserves user input, evaluates conversation context, and persists the assistant completion.

#### Request Body
```json
{
  "sessionId": "6733f1122a1b9c0012e84511",
  "content": "How do I identify outliers using the IQR method?"
}
```

#### Validation Rules
- `sessionId`: Must be a valid 24-character hexadecimal MongoDB ObjectId referring to an existing session.
- `content`: Non-empty string (trimmed of leading/trailing whitespace).

#### Error Responses
- `400 Bad Request` if content is empty or whitespace:
  ```json
  {
    "error": {
      "code": "INVALID_MESSAGE_CONTENT",
      "message": "Message content cannot be empty."
    }
  }
  ```
- `502 Bad Gateway` / `429 Too Many Requests` on upstream provider failure (saves an error message bubble to the database):
  ```json
  {
    "error": {
      "code": "MISTRAL_AUTH_FAILED",
      "message": "Mistral API Error (401): Unauthorized"
    },
    "message": {
      "id": "6733f1302a1b9c0012e84514",
      "sessionId": "6733f1122a1b9c0012e84511",
      "content": "Error: Mistral API Error (401): Unauthorized",
      "role": "assistant",
      "timestamp": "2026-11-13T01:15:25.000Z",
      "isError": true
    }
  }
  ```

#### Success Response (`200 OK`)
```json
{
  "id": "6733f1352a1b9c0012e84515",
  "sessionId": "6733f1122a1b9c0012e84511",
  "content": "The Interquartile Range (IQR) method identifies outliers as points falling below Q1 - 1.5*IQR or above Q3 + 1.5*IQR.",
  "role": "assistant",
  "timestamp": "2026-11-13T01:15:28.000Z",
  "attachments": [],
  "isError": false
}
```


import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

const AgentContext = createContext(null);

export const SCREENS = {
  HOME: 'home',
  CHAT: 'chat',
  SETTINGS: 'settings'
};

export const SYSTEM_PROMPT = `You are a data analyst AI assistant. Your role is to:
1. Load and explore datasets from files or URLs
2. Perform statistical analysis and data cleaning
3. Create visualizations using matplotlib/plotly
4. Answer questions about data with clear explanations
5. Provide actionable insights with proper caveats`;

/**
 * AgentProvider component providing application-wide state management.
 * Manages active session, conversation message history, loading state, error state,
 * and zero-dependency stack-based screen navigation.
 */
export function AgentProvider({ children }) {
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentScreen, setCurrentScreen] = useState(SCREENS.HOME);

  // Sync browser back/forward buttons with stack navigation
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.screen) {
        setCurrentScreen(event.state.screen);
      } else {
        setCurrentScreen(SCREENS.HOME);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Navigate between Home, Chat, and Settings without third-party router dependencies.
   */
  const navigateTo = useCallback((screen) => {
    if (Object.values(SCREENS).includes(screen)) {
      setCurrentScreen(screen);
      window.history.pushState({ screen }, '', `#${screen}`);
    }
  }, []);

  const goBack = useCallback(() => {
    setCurrentScreen(SCREENS.HOME);
    window.history.pushState({ screen: SCREENS.HOME }, '', `#${SCREENS.HOME}`);
  }, []);

  /**
   * Initializes a new session on the Express backend and resets local conversation state.
   */
  const startNewSession = useCallback(async (agentName = 'Data analyst', model = 'mistral-large-latest') => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await api.createSession({ agentName, model });
      setCurrentSession(session);
      setMessages([]);
      navigateTo(SCREENS.CHAT);
      return session;
    } catch (err) {
      console.error('[AgentContext] Failed to start new session:', err.message);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [navigateTo]);

  /**
   * Loads an existing session and its full chronological message history from the backend.
   */
  const loadSession = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSession(sessionId);
      setCurrentSession(data.session);
      setMessages(data.messages || []);
      return data;
    } catch (err) {
      console.error(`[AgentContext] Failed to load session ${sessionId}:`, err.message);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Dispatches a user prompt to the backend chat completions endpoint.
   * Optimistically records the user prompt, updates state with the assistant completion,
   * or records an error message bubble upon failure.
   */
  const sendMessage = useCallback(async (text) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return;
    }

    const trimmedText = text.trim();
    setError(null);

    // Ensure an active session exists before sending messages
    let activeSession = currentSession;
    if (!activeSession || !activeSession.id) {
      try {
        activeSession = await api.createSession({
          agentName: 'Data analyst',
          model: 'mistral-large-latest'
        });
        setCurrentSession(activeSession);
      } catch (sessionErr) {
        setError(`Cannot initiate session: ${sessionErr.message}`);
        return;
      }
    }

    // Optimistically append user message to UI state
    const optimisticUserMessage = {
      id: `temp-${Date.now()}`,
      sessionId: activeSession.id,
      content: trimmedText,
      role: 'user',
      timestamp: new Date().toISOString(),
      isError: false
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setIsLoading(true);

    try {
      const assistantMessage = await api.sendChatMessage(activeSession.id, trimmedText);
      setMessages((prev) => [...prev, assistantMessage]);
      return assistantMessage;
    } catch (err) {
      console.error('[AgentContext] Message dispatch failed:', err.message);
      // Display error bubble in chat list
      const errorBubble = {
        id: `err-${Date.now()}`,
        sessionId: activeSession.id,
        content: `Error: ${err.message}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages((prev) => [...prev, errorBubble]);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  /**
   * Clears the active conversation history on the backend and in local state.
   */
  const clearHistory = useCallback(async () => {
    if (!currentSession || !currentSession.id) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      await api.clearSessionMessages(currentSession.id);
      setMessages([]);
    } catch (err) {
      console.error('[AgentContext] Failed to clear history:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  const value = {
    currentSession,
    messages,
    isLoading,
    error,
    currentScreen,
    navigateTo,
    goBack,
    startNewSession,
    loadSession,
    sendMessage,
    clearHistory,
    systemPrompt: SYSTEM_PROMPT
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}

export default AgentContext;


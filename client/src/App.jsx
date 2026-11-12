import React from 'react';
import { AgentProvider, useAgent, SCREENS } from './context/AgentContext.jsx';
import HomePage from './pages/HomePage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

/**
 * Root Router / Switcher managing application screen transitions.
 * Selects active screen based on AgentContext's currentScreen.
 */
function AppRouter() {
  const { currentScreen } = useAgent();

  switch (currentScreen) {
    case SCREENS.CHAT:
      return <ChatPage />;
    case SCREENS.SETTINGS:
      return <SettingsPage />;
    case SCREENS.HOME:
    default:
      return <HomePage />;
  }
}

/**
 * Main Application Component wrapping the application tree in AgentProvider.
 */
export default function App() {
  return (
    <AgentProvider>
      <AppRouter />
    </AgentProvider>
  );
}

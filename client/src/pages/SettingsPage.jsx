import React, { useState } from 'react';
import { useAgent } from '../context/AgentContext.jsx';
import {
  ArrowBackIcon,
  KeyIcon,
  ChevronRightIcon
} from '../components/Icons.jsx';

/**
 * SettingsPage component managing application preferences and API configuration.
 * Provides controls for model selection, reasoning/streaming toggles,
 * and backend-managed security status notices.
 */
export function SettingsPage() {
  const { goBack } = useAgent();

  const [showToast, setShowToast] = useState(false);
  const [showPlaceholderNotice, setShowPlaceholderNotice] = useState(false);

  const handleSave = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      goBack();
    }, 900);
  };

  return (
    <div className="min-h-screen bg-scaffold text-white flex flex-col font-sans selection:bg-brand-primary/30">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 bg-scaffold/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-4 flex items-center space-x-3">
        <button
          onClick={goBack}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          title="Back"
          aria-label="Back"
        >
          <ArrowBackIcon className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display font-bold text-white">Settings</h1>
      </header>

      {/* Settings Form Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-6 sm:p-8 space-y-8">
        {/* Section 1: API Configuration */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3 text-brand-primary">
            <KeyIcon className="w-5 h-5" />
            <h2 className="text-sm font-bold tracking-wider text-white/90 uppercase">
              API Configuration
            </h2>
          </div>

          <div className="bg-card rounded-[20px] p-5 border border-white/5 space-y-3">
            <label className="block text-white/70 text-xs font-medium">
              Mistral API Key
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                disabled
                placeholder="Managed on backend (server/.env)"
                className="w-full bg-black/30 border border-white/5 text-white/40 placeholder-white/20 rounded-xl px-4 py-3 text-sm font-mono cursor-not-allowed focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Mistral API credentials are managed securely on the backend. Configuration status has not yet been verified.
            </p>
          </div>
        </section>

        {/* Section 2: Agent Preferences */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3 text-brand-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h2 className="text-sm font-bold tracking-wider text-white/90 uppercase">
              Agent Preferences
            </h2>
          </div>

          <div className="space-y-3">
            {/* Model Selector Tile */}
            <div
              onClick={() => setShowPlaceholderNotice(true)}
              className="bg-card rounded-[20px] p-5 border border-white/5 flex items-center justify-between cursor-pointer hover:border-white/10 transition-colors"
            >
              <div>
                <div className="text-white text-sm font-bold">Mistral Model</div>
                <div className="text-white/40 text-xs font-mono mt-0.5">
                  mistral-large-latest
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60">
                <ChevronRightIcon className="w-4 h-4" />
              </div>
            </div>

            {showPlaceholderNotice && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/60 flex items-center justify-between">
                <span>Model selection is fixed to <code>mistral-large-latest</code> per approved specification.</span>
                <button
                  onClick={() => setShowPlaceholderNotice(false)}
                  className="text-white/40 hover:text-white ml-2 text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Toggle 1: Advanced Reasoning */}
            <div className="bg-card rounded-[20px] p-4 sm:p-5 border border-white/5 flex items-center justify-between select-none">
              <span className="text-white text-sm font-medium">Advanced Reasoning</span>
              <div
                className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-default rounded-full border-2 border-transparent bg-brand-primary"
                role="switch"
                aria-checked={true}
                aria-disabled={true}
              >
                <span className="pointer-events-none inline-block h-5 w-5 transform translate-x-5 rounded-full bg-white shadow ring-0" />
              </div>
            </div>

            {/* Toggle 2: Streaming Responses */}
            <div className="bg-card rounded-[20px] p-4 sm:p-5 border border-white/5 flex items-center justify-between select-none">
              <span className="text-white text-sm font-medium">Streaming Responses</span>
              <div
                className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-default rounded-full border-2 border-transparent bg-white/10"
                role="switch"
                aria-checked={false}
                aria-disabled={true}
              >
                <span className="pointer-events-none inline-block h-5 w-5 transform translate-x-0 rounded-full bg-white shadow ring-0" />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: About */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3 text-brand-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-sm font-bold tracking-wider text-white/90 uppercase">
              About
            </h2>
          </div>

          <div className="bg-card rounded-[20px] p-5 border border-white/5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Version</span>
              <span className="text-white font-bold font-mono">1.0.0</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-white/60">Framework</span>
              <span className="text-white font-bold">React 18</span>
            </div>
          </div>
        </section>

        {/* Save Configuration Button */}
        <div className="pt-4">
          <button
            onClick={handleSave}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-primary to-blue-600 text-white font-bold text-sm tracking-wide shadow-xl hover:opacity-95 active:scale-98 transition-all flex items-center justify-center space-x-2"
          >
            <span>Save Configuration</span>
          </button>
        </div>
      </main>

      {/* Confirmation Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm shadow-2xl flex items-center space-x-2 animate-bounce">
          <span>✓</span>
          <span>Settings saved successfully</span>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;

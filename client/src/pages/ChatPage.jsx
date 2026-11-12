import React, { useState, useRef, useEffect } from 'react';
import { useAgent } from '../context/AgentContext.jsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer.jsx';
import {
  ArrowBackIcon,
  TrashIcon,
  AnalyticsIcon,
  PersonIcon,
  SparklesIcon,
  PlusIcon,
  ArrowUpIcon
} from '../components/Icons.jsx';

/**
 * ChatPage component providing the interactive data analysis conversation interface.
 * Supports user/assistant bubbles, Markdown parsing, simulated file picker interaction,
 * loading indicator, and history clearing.
 */
export function ChatPage() {
  const {
    currentSession,
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    goBack
  } = useAgent();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom on new messages or loading state change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // File picker simulation helper
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputText(`I've uploaded ${file.name}. Please analyze it.`);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const textToSend = inputText;
    setInputText('');
    await sendMessage(textToSend);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-scaffold text-white font-sans selection:bg-brand-primary/30">
      {/* Top App Bar (Replicating AppBar in chat_screen.dart) */}
      <header className="sticky top-0 z-20 bg-scaffold/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={goBack}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            title="Back to Home"
            aria-label="Back"
          >
            <ArrowBackIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold font-display text-white">
              Analysis Session
            </h1>
            <div className="text-xs font-mono text-white/40">
              {currentSession?.model || 'mistral-large-latest'}
            </div>
          </div>
        </div>

        <button
          onClick={clearHistory}
          className="p-2 rounded-xl text-white/60 hover:text-red-400 hover:bg-white/5 transition-colors"
          title="Clear History"
          aria-label="Clear History"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </header>

      {/* Messages Scroll Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty State (Replicating _buildEmptyState in chat_screen.dart) */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
            <div className="p-6 rounded-full bg-white/[0.03] text-brand-primary/50 mb-6">
              <AnalyticsIcon className="w-16 h-16" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-white/70 mb-2">
              Ready to analyze
            </h2>
            <p className="text-white/40 text-sm max-w-sm">
              Upload a dataset or ask a question to begin.
            </p>
          </div>
        ) : (
          /* Message List (Replicating _buildMessageBubble in chat_screen.dart) */
          messages.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id || index}
                className={`flex items-start space-x-3 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-9 h-9 rounded-full bg-brand-secondary/20 border border-white/10 flex items-center justify-center text-brand-secondary flex-shrink-0">
                    <SparklesIcon className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`p-4 shadow-md ${
                      isUser
                        ? 'bg-brand-primary text-white rounded-2xl rounded-br-sm'
                        : message.isError
                        ? 'bg-red-950/40 text-red-200 border border-red-500/30 rounded-2xl rounded-bl-sm'
                        : 'bg-card text-white/90 border border-white/5 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    <MarkdownRenderer content={message.content} isUser={isUser} />
                  </div>
                  <span className="text-[11px] text-white/25 mt-1 px-1">
                    {isUser ? 'You' : 'Mistral Analyst'}
                  </span>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 flex-shrink-0">
                    <PersonIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Indicator (Replicating _buildLoadingIndicator in chat_screen.dart) */}
        {isLoading && (
          <div className="flex items-start space-x-3 justify-start">
            <div className="w-9 h-9 rounded-full bg-brand-secondary/20 border border-white/10 flex items-center justify-center text-brand-secondary flex-shrink-0">
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div className="bg-card rounded-2xl px-4 py-3 border border-white/5 flex items-center space-x-3 shadow-md">
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              <span className="text-xs text-white/40 font-medium">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Area (Replicating _buildInputArea in chat_screen.dart) */}
      <footer className="bg-surface border-t border-white/5 p-4 sm:p-5">
        <div className="max-w-4xl mx-auto flex items-center space-x-3">
          {/* Hidden File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.json,.xlsx,.parquet"
            className="hidden"
          />

          {/* Plus / Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
            title="Upload Data"
            aria-label="Upload Data"
          >
            <PlusIcon className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full bg-white/[0.03] border border-white/10 focus:border-brand-primary/50 text-white placeholder-white/25 rounded-[28px] px-6 py-3.5 text-sm resize-none focus:outline-none transition-colors"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white flex items-center justify-center shadow-lg hover:opacity-95 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            title="Send Message"
            aria-label="Send Message"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default ChatPage;


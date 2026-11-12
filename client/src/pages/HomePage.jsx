import React from 'react';
import { useAgent, SCREENS } from '../context/AgentContext.jsx';
import {
  SettingsIcon,
  AnalyticsIcon,
  InsightsIcon,
  BarChartIcon,
  CleaningIcon,
  SparklesIcon,
  HistoryIcon,
  PlusIcon
} from '../components/Icons.jsx';

/**
 * HomePage component providing the primary landing dashboard.
 * Displays branding, hero banner, 2x2 capabilities grid, recent analysis section,
 * and the "New Analysis" action trigger.
 */
export function HomePage() {
  const { navigateTo, startNewSession, isLoading } = useAgent();

  const handleNewAnalysis = async () => {
    try {
      await startNewSession('Data Analyst', 'mistral-large-latest');
    } catch (err) {
      console.error('Failed to initialize session:', err);
    }
  };

  return (
    <div className="min-h-screen bg-scaffold text-white flex flex-col font-sans relative selection:bg-brand-primary/30">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 bg-scaffold/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white/90 tracking-wider">
          Mistral Analyst
        </h1>
        <button
          onClick={() => navigateTo(SCREENS.SETTINGS)}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Scrollable Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 space-y-10">
        {/* Hero Banner (Replicating _buildHero in home_screen.dart) */}
        <section className="relative overflow-hidden w-full rounded-[32px] p-8 sm:p-10 bg-gradient-to-br from-brand-primary to-brand-secondary shadow-[0_10px_25px_rgba(99,102,241,0.3)]">
          {/* Watermark Background Analytics Icon */}
          <div className="absolute -right-6 -top-6 text-white/10 pointer-events-none select-none">
            <AnalyticsIcon className="w-44 h-44" />
          </div>

          <div className="relative z-10 flex flex-col items-start max-w-xl">
            {/* Powered Badge */}
            <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/10 text-white text-[10px] font-bold tracking-widest uppercase mb-5">
              POWERED BY MISTRAL LARGE
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white leading-tight mb-3">
              Master your data.
            </h2>

            {/* Subtitle */}
            <p className="text-white/80 text-sm sm:text-base leading-relaxed">
              Upload datasets and get instant insights with our advanced AI analyst.
            </p>
          </div>
        </section>

        {/* Capabilities Section (Replicating _buildCapabilitiesGrid in home_screen.dart) */}
        <section>
          <h3 className="text-lg sm:text-xl font-display font-bold text-white tracking-wide mb-5">
            Capabilities
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Card 1: Statistical Analysis */}
            <div className="bg-card rounded-[20px] p-5 border border-white/5 flex flex-col justify-between h-32 hover:border-white/10 transition-colors">
              <InsightsIcon className="w-6 h-6 text-brand-secondary" />
              <div>
                <div className="text-white/70 text-xs sm:text-sm">Statistical</div>
                <div className="text-white text-sm sm:text-base font-bold">Analysis</div>
              </div>
            </div>

            {/* Card 2: Visual Charts */}
            <div className="bg-card rounded-[20px] p-5 border border-white/5 flex flex-col justify-between h-32 hover:border-white/10 transition-colors">
              <BarChartIcon className="w-6 h-6 text-brand-secondary" />
              <div>
                <div className="text-white/70 text-xs sm:text-sm">Visual</div>
                <div className="text-white text-sm sm:text-base font-bold">Charts</div>
              </div>
            </div>

            {/* Card 3: Data Cleaning */}
            <div className="bg-card rounded-[20px] p-5 border border-white/5 flex flex-col justify-between h-32 hover:border-white/10 transition-colors">
              <CleaningIcon className="w-6 h-6 text-brand-secondary" />
              <div>
                <div className="text-white/70 text-xs sm:text-sm">Data</div>
                <div className="text-white text-sm sm:text-base font-bold">Cleaning</div>
              </div>
            </div>

            {/* Card 4: Deep Insights */}
            <div className="bg-card rounded-[20px] p-5 border border-white/5 flex flex-col justify-between h-32 hover:border-white/10 transition-colors">
              <SparklesIcon className="w-6 h-6 text-brand-secondary" />
              <div>
                <div className="text-white/70 text-xs sm:text-sm">Deep</div>
                <div className="text-white text-sm sm:text-base font-bold">Insights</div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Analysis Section (Replicating _buildRecentList in home_screen.dart) */}
        <section className="pb-24">
          <h3 className="text-lg sm:text-xl font-display font-bold text-white tracking-wide mb-4">
            Recent Analysis
          </h3>

          <div className="w-full py-12 px-6 rounded-3xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center">
            <HistoryIcon className="w-12 h-12 text-white/10 mb-3" />
            <p className="text-white/40 text-sm">
              No recent analysis history
            </p>
          </div>
        </section>
      </main>

      {/* Floating Action Button (Replicating FloatingActionButton.extended in home_screen.dart) */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30">
        <button
          onClick={handleNewAnalysis}
          disabled={isLoading}
          className="group flex items-center space-x-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold text-sm tracking-wide shadow-2xl hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
          aria-label="New Analysis"
        >
          <PlusIcon className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" />
          <span>{isLoading ? 'Creating Session...' : 'New Analysis'}</span>
        </button>
      </div>
    </div>
  );
}

export default HomePage;


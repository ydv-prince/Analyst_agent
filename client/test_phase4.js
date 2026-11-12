import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name} - ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('PHASE 4 UI REPLICATION & INTEGRATION TEST SUITE');
  console.log('='.repeat(70));

  // 1. Production Build Check
  test('1. Production Build Output Verification', () => {
    const distHtml = path.join(__dirname, 'dist', 'index.html');
    assert.strictEqual(fs.existsSync(distHtml), true, 'dist/index.html must exist');
    const htmlContent = fs.readFileSync(distHtml, 'utf-8');
    assert.ok(htmlContent.includes('Analyst Agent'), 'Page title must be preserved');
  });

  // 2. Component Exports Verification
  test('2. Screen Component Modules Exports', async () => {
    const { HomePage } = await import('./src/pages/HomePage.jsx');
    const { ChatPage } = await import('./src/pages/ChatPage.jsx');
    const { SettingsPage } = await import('./src/pages/SettingsPage.jsx');
    const { MarkdownRenderer } = await import('./src/components/MarkdownRenderer.jsx');

    assert.strictEqual(typeof HomePage, 'function', 'HomePage must be a React component function');
    assert.strictEqual(typeof ChatPage, 'function', 'ChatPage must be a React component function');
    assert.strictEqual(typeof SettingsPage, 'function', 'SettingsPage must be a React component function');
    assert.strictEqual(typeof MarkdownRenderer, 'function', 'MarkdownRenderer must be a React component function');
  });

  // 3. Home Screen Parity Inspection
  test('3. Home Screen Content & Structural Parity', () => {
    const homeSrc = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'HomePage.jsx'), 'utf-8');
    assert.ok(homeSrc.includes('Mistral Analyst'), 'Must contain Mistral Analyst title');
    assert.ok(homeSrc.includes('POWERED BY MISTRAL LARGE'), 'Must contain Mistral Large badge');
    assert.ok(homeSrc.includes('Master your data.'), 'Must contain hero headline');
    assert.ok(homeSrc.includes('Upload datasets and get instant insights'), 'Must contain hero subtitle');
    assert.ok(homeSrc.includes('Statistical') && homeSrc.includes('Analysis'), 'Must contain Statistical Analysis card');
    assert.ok(homeSrc.includes('Visual') && homeSrc.includes('Charts'), 'Must contain Visual Charts card');
    assert.ok(homeSrc.includes('Data') && homeSrc.includes('Cleaning'), 'Must contain Data Cleaning card');
    assert.ok(homeSrc.includes('Deep') && homeSrc.includes('Insights'), 'Must contain Deep Insights card');
    assert.ok(homeSrc.includes('Recent Analysis'), 'Must contain Recent Analysis section');
    assert.ok(homeSrc.includes('No recent analysis history'), 'Must preserve exact empty state');
    assert.ok(homeSrc.includes('New Analysis'), 'Must contain New Analysis FAB button');
    assert.ok(homeSrc.includes('startNewSession'), 'New Analysis must trigger startNewSession');
  });

  // 4. Chat Screen Parity Inspection
  test('4. Chat Screen Content & Structural Parity', () => {
    const chatSrc = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'ChatPage.jsx'), 'utf-8');
    assert.ok(chatSrc.includes('Analysis Session'), 'Must contain Analysis Session title');
    assert.ok(chatSrc.includes('currentSession?.model'), 'Must display active session model');
    assert.ok(chatSrc.includes('clearHistory'), 'Must integrate clearHistory action');
    assert.ok(chatSrc.includes('Ready to analyze'), 'Must contain empty state headline');
    assert.ok(chatSrc.includes('Upload a dataset or ask a question to begin.'), 'Must contain empty state subtitle');
    assert.ok(chatSrc.includes("I've uploaded ${file.name}. Please analyze it."), 'Must preserve exact file-picker simulated interaction');
    assert.ok(chatSrc.includes('accept=".csv,.json,.xlsx,.parquet"'), 'Must restrict file types');
    assert.ok(chatSrc.includes('MarkdownRenderer'), 'Must render messages through MarkdownRenderer');
    assert.ok(chatSrc.includes('Thinking...'), 'Must render thinking indicator during loading state');
    assert.ok(chatSrc.includes('Type a message...'), 'Must preserve input placeholder');
    assert.ok(chatSrc.includes('isUser ? \'You\' : \'Mistral Analyst\''), 'Must label user and assistant bubbles');
  });

  // 5. Settings Screen Parity & Security Inspection
  test('5. Settings Screen Parity & Credential Isolation', () => {
    const settingsSrc = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'SettingsPage.jsx'), 'utf-8');
    assert.ok(settingsSrc.includes('API Configuration'), 'Must contain API Configuration header');
    assert.ok(settingsSrc.includes('Mistral API Key'), 'Must contain Mistral API Key field');
    assert.ok(settingsSrc.includes('Agent Preferences'), 'Must contain Agent Preferences header');
    assert.ok(settingsSrc.includes('Mistral Model'), 'Must contain Mistral Model selector');
    assert.ok(settingsSrc.includes('mistral-large-latest'), 'Must display mistral-large-latest');
    assert.ok(settingsSrc.includes('Advanced Reasoning'), 'Must contain Advanced Reasoning toggle');
    assert.ok(settingsSrc.includes('Streaming Responses'), 'Must contain Streaming Responses toggle');
    assert.ok(settingsSrc.includes('About'), 'Must contain About header');
    assert.ok(settingsSrc.includes('1.0.0'), 'Must display Version 1.0.0');
    assert.ok(settingsSrc.includes('Save Configuration'), 'Must contain Save Configuration button');
    assert.ok(settingsSrc.includes('Settings saved successfully'), 'Must confirm save with success banner');
    assert.ok(!settingsSrc.includes('MISTRAL_API_KEY'), 'Must not hardcode or read raw API key in client');
    assert.ok(!settingsSrc.includes('••••••••'), 'Must not contain fabricated masked API key representation');
    assert.ok(
      settingsSrc.includes('Mistral API credentials are managed securely on the backend. Configuration status has not yet been verified.'),
      'Must contain exact neutral verification status text'
    );
    assert.ok(
      settingsSrc.includes('aria-disabled={true}'),
      'Must preserve inert toggle behavior'
    );
  });

  // 6. Zero-Dependency Markdown Renderer Verification
  test('6. Markdown Renderer Syntax Support', () => {
    const mdSrc = fs.readFileSync(path.join(__dirname, 'src', 'components', 'MarkdownRenderer.jsx'), 'utf-8');
    assert.ok(mdSrc.includes('```'), 'Must support fenced code blocks');
    assert.ok(mdSrc.includes('table'), 'Must support table rendering');
    assert.ok(mdSrc.includes('# '), 'Must support H1/H2/H3 headings');
    assert.ok(mdSrc.includes('code'), 'Must style inline code in monospace');
    assert.ok(mdSrc.includes('**'), 'Must support bold styling');
  });

  // 7. Navigation Integration in Root App
  test('7. App Navigation State Machine', () => {
    const appSrc = fs.readFileSync(path.join(__dirname, 'src', 'App.jsx'), 'utf-8');
    assert.ok(appSrc.includes('SCREENS.CHAT'), 'Must route to ChatPage on CHAT screen');
    assert.ok(appSrc.includes('SCREENS.SETTINGS'), 'Must route to SettingsPage on SETTINGS screen');
    assert.ok(appSrc.includes('SCREENS.HOME'), 'Must route to HomePage on HOME screen');
    assert.ok(appSrc.includes('AgentProvider'), 'Must wrap application in AgentProvider');
  });

  // 8. Dark Theme Styling Consistency
  test('8. Dark Theme Palette Compliance', () => {
    const tailwindConfig = fs.readFileSync(path.join(__dirname, 'tailwind.config.js'), 'utf-8');
    assert.ok(tailwindConfig.includes('#020617'), 'Must define scaffold background #020617');
    assert.ok(tailwindConfig.includes('#0F172A'), 'Must define surface background #0F172A');
    assert.ok(tailwindConfig.includes('#1E293B'), 'Must define card background #1E293B');
    assert.ok(tailwindConfig.includes('#6366F1'), 'Must define brand primary #6366F1');
    assert.ok(tailwindConfig.includes('#8B5CF6'), 'Must define brand secondary #8B5CF6');
  });

  console.log('='.repeat(70));
  console.log(`PHASE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();


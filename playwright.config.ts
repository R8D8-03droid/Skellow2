import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 30_000,
  outputDir: '.context/browser-results',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    viewport: { width: 1440, height: 1050 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: 'npm run dev -- --port 3101 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: false,
    env: {
      VITE_DATA_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://mock.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_test',
    },
  },
});

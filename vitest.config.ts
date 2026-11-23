import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'

export default defineConfig({
  optimizeDeps: { include: ['storybook/theming', '@base-ui/react/toast', '@base-ui/react/toggle', '@base-ui/react/toggle-group'] },
  plugins: [storybookTest({ configDir: '.storybook' })],
  test: {
    name: 'storybook',
    browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
})

import { ToastProvider } from '../src/design-system/Toast'
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import { theme } from './theme'

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [(Story) => <ToastProvider><div className="bl-system" lang="ko"><Story /></div></ToastProvider>],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    a11y: { test: 'error' },
    options: { storySort: { order: ['시작하기', 'Foundations', 'Components', 'Patterns'] } },
    docs: { codePanel: true, theme },
  },
}
export default preview

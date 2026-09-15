import { create } from 'storybook/theming'

// Storybook's manager and Docs require concrete colors, not CSS custom properties.
export const theme = create({
  base: 'light',
  brandTitle: 'Branchline · Design System',
  colorPrimary: '#000000',
  colorSecondary: '#000000',
  appBg: '#fafafa',
  appContentBg: '#ffffff',
  appPreviewBg: '#fafafa',
  appBorderColor: '#e5e5e5',
  textColor: '#000000',
  textInverseColor: '#ffffff',
  textMutedColor: '#666666',
  barTextColor: '#666666',
  barSelectedColor: '#000000',
  barHoverColor: '#000000',
  barBg: '#ffffff',
  buttonBg: '#ffffff',
  buttonBorder: '#e5e5e5',
  inputBg: '#ffffff',
  inputBorder: '#e5e5e5',
  inputTextColor: '#000000',
})

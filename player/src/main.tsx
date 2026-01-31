import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme } from './config/theme'
import 'src/index.css'
import App from 'src/App.tsx'
import 'src/config/i18n'

// Valid theme color values
const VALID_THEMES = [
  'neutral',
  'blue',
  'green',
  'red',
  'orange',
  'yellow',
  'purple',
  'pink',
] as const

// Get theme color from configuration object or use default
// Validate against whitelist for security
const rawThemeColor = window.RADPLAPAG_CONFIG?.themeColor || window.THEME_COLOR || 'neutral'
const themeColor =
  VALID_THEMES.includes(rawThemeColor as any) ? rawThemeColor : 'neutral'
const themeInstance = getTheme(themeColor)

// Initialize React app with Material-UI theme provider
// ThemeProvider wraps the entire app to provide theme context
// CssBaseline applies consistent baseline styles across browsers
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={themeInstance}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme } from './config/theme'
import 'src/index.css'
import App from 'src/App.tsx'
import 'src/config/i18n'

// Get theme color from global window variable or use default
const themeColor = window.THEME_COLOR || 'neutral'
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

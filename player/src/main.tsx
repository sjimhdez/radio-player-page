import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme } from './config/theme'
import useConfig from 'src/hooks/use-config'
import 'src/index.css'
import App from 'src/App.tsx'
import 'src/config/i18n'

/**
 * Wrapper component that provides Material-UI theme based on plugin configuration.
 *
 * This component uses the useConfig() hook to access the plugin configuration
 * and applies the appropriate theme color. The theme is validated and sanitized
 * by the useConfig() hook, ensuring consistency with the rest of the application.
 */
function ThemeProviderWrapper() {
  const config = useConfig()
  const themeInstance = getTheme(config.themeColor)

  return (
    <ThemeProvider theme={themeInstance}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

// Initialize React app with Material-UI theme provider
// ThemeProvider wraps the entire app to provide theme context
// CssBaseline applies consistent baseline styles across browsers
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProviderWrapper />
  </StrictMode>,
)

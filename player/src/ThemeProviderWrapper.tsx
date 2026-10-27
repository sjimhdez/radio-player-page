import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useTranslation } from 'react-i18next'
import { getTheme } from './config/theme'
import useConfig from 'src/hooks/use-config'
import App from 'src/App.tsx'

/**
 * Wrapper component that provides Material-UI theme based on plugin configuration.
 *
 * This component uses the useConfig() hook to access the plugin configuration
 * and applies the appropriate theme color. The theme is validated and sanitized
 * by the useConfig() hook, ensuring consistency with the rest of the application.
 * The theme also gives the player's language to the portals (K62).
 */
export default function ThemeProviderWrapper() {
  const config = useConfig()
  const { i18n } = useTranslation()
  const themeInstance = getTheme(config.themeColor, i18n.resolvedLanguage)

  return (
    <ThemeProvider theme={themeInstance}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

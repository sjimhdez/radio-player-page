import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useTranslation } from 'react-i18next'
import { getTheme } from 'src/config/theme'
import useConfig from 'src/hooks/use-config'
import App from 'src/app/App'

/**
 * Provides the MUI theme of the configured color, already validated by useConfig(), and
 * the player's language for the portals (K62).
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

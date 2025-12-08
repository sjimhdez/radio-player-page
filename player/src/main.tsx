import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme } from './config/theme'
import 'src/index.css'
import App from 'src/App.tsx'
import 'src/config/i18n'

const themeColor = window.THEME_COLOR || 'neutral'
const themeInstance = getTheme(themeColor)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={themeInstance}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)

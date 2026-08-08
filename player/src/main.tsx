import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ThemeProviderWrapper from 'src/ThemeProviderWrapper'
import 'src/index.css'
import 'src/config/i18n'

// Initialize React app with Material-UI theme provider
// ThemeProvider wraps the entire app to provide theme context
// CssBaseline applies consistent baseline styles across browsers
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProviderWrapper />
  </StrictMode>,
)

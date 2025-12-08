import { createTheme, type PaletteOptions, type Theme, type ThemeOptions } from '@mui/material/styles'

// Base theme configuration shared across all themes
const baseThemeOptions: Omit<ThemeOptions, 'palette'> = {
  typography: {
    fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '0em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '0.00735em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '0em',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '0.0075em',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.75,
      letterSpacing: '0.00938em',
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.57,
      letterSpacing: '0.00714em',
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.43,
      letterSpacing: '0.01071em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.75,
      letterSpacing: '0.02857em',
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.66,
      letterSpacing: '0.03333em',
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 2.66,
      letterSpacing: '0.08333em',
      textTransform: 'uppercase',
    },
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
  },
}

const neutralPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#FFFFFF',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#000000',
    paper: '#121212',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
  },
  divider: '#333333',
}

const redPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#FF073A',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FF073A',
  },
  background: {
    default: '#000000',
    paper: '#121212',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
  },
  divider: '#333333',
}

const greenPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#39FF14',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#39FF14',
  },
  background: {
    default: '#000000',
    paper: '#121212',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
  },
  divider: '#333333',
}

const bluePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#00FFFF',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#00FFFF',
  },
  background: {
    default: '#000000',
    paper: '#121212',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
  },
  divider: '#333333',
}

const yellowPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#FFFF00',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FFFF00',
  },
  background: {
    default: '#000000',
    paper: '#121212',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
  },
  divider: '#333333',
}

const purplePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#BC13FE',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#BC13FE',
  },
  background: {
    default: '#000000',
    paper: '#121212',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
  },
  divider: '#333333',
}

const orangePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#FF5F1F',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FF5F1F',
  },
  background: {
    default: '#000000',
    paper: '#121212',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
  },
  divider: '#333333',
}

// Map theme keys to palette objects
const palettes: Record<string, PaletteOptions> = {
  neutral: neutralPalette,
  red: redPalette,
  green: greenPalette,
  blue: bluePalette,
  yellow: yellowPalette,
  purple: purplePalette,
  orange: orangePalette,
}

export const getTheme = (colorMode: string = 'neutral'): Theme => {
  const selectedPalette = palettes[colorMode] || palettes.neutral

  return createTheme({
    ...baseThemeOptions,
    palette: selectedPalette,
  })
}

export default getTheme('neutral')

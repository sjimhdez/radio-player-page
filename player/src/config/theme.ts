import {
  createTheme,
  type PaletteOptions,
  type Theme,
  type ThemeOptions,
} from '@mui/material/styles'

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

const bluePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#009ACE',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#009ACE',
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
    main: '#44D62C',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#44D62C',
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
    main: '#FFE900',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FFE900',
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
    main: '#FFAA4D',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FFAA4D',
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
    main: '#FF0033',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FF0033',
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

const pinkPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#FF3EB5',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#FF3EB5',
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
    main: '#EA27C2',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    contrastText: '#EA27C2',
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

const palettes: Record<string, PaletteOptions> = {
  neutral: neutralPalette,
  red: redPalette,
  green: greenPalette,
  blue: bluePalette,
  yellow: yellowPalette,
  purple: purplePalette,
  orange: orangePalette,
  pink: pinkPalette,
}

export const getTheme = (colorMode: string = 'neutral'): Theme => {
  const selectedPalette = palettes[colorMode] || palettes.neutral

  return createTheme({
    ...baseThemeOptions,
    palette: selectedPalette,
  })
}

export default getTheme('neutral')

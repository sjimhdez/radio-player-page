import { Typography, Stack, Collapse, Box } from '@mui/material'
import CircleRounded from '@mui/icons-material/CircleRounded'
import { useTranslation } from 'react-i18next'

interface StreamInfoProps {
  title: string
  isPlaying: boolean
  canVisualize: boolean
  loading: boolean
}

const StreamInfo = ({ title, isPlaying, canVisualize, loading }: StreamInfoProps) => {
  const { t } = useTranslation()

  return (
    <Stack
      position={'absolute'}
      top={canVisualize && isPlaying ? 16 : 'calc(50% - 2rem)'}
      textAlign={'center'}
      sx={{ transition: 'all 0.8s ease' }}
      zIndex={(theme) => theme.zIndex.tooltip}
      gap={1}
      px={2}
      py={1}
      alignItems="center"
      justifyContent="center"
    >
      {window.LOGO_IMAGE && (
        <Box
          component="img"
          src={window.LOGO_IMAGE}
          alt="Logo"
          sx={{
            width: 75,
            height: 75,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      )}
      <Typography variant="h1" component="h1" sx={{ textWrap: 'balance', hyphens: 'auto' }}>
        {title}
      </Typography>

      {loading && (
        <Typography
          component="p"
          variant="h5"
          sx={{
            textWrap: 'balance',
            hyphens: 'auto',
            animation: 'blink 2s infinite',
            '@keyframes blink': { '0%, 100%': { opacity: 0 }, '50%': { opacity: 1 } },
          }}
        >
          Conectando
        </Typography>
      )}

      <Collapse
        in={isPlaying && !canVisualize}
        timeout={2000}
        collapsedSize={0}
        orientation="horizontal"
      >
        <Stack direction={'row'} alignItems={'center'} gap={1}>
          <Typography variant="h5" whiteSpace={'nowrap'}>
            {t('dashboard.isOnLive')}
          </Typography>
          <CircleRounded
            color="error"
            fontSize="small"
            sx={{
              animation: 'blink 1s infinite',
              '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }}
          />
        </Stack>
      </Collapse>
    </Stack>
  )
}

export default StreamInfo

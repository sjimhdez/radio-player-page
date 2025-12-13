import Slider from '@mui/material/Slider'
import { VolumeMute, VolumeUp } from '@mui/icons-material'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { useIsIOS } from 'src/hooks/use-is-ios'

interface VolumeControlProps {
  volume: number
  onVolumeChange: (volume: number) => void
}

const VolumeControl = ({ volume, onVolumeChange }: VolumeControlProps) => {
  const { t } = useTranslation()
  const isIOS = useIsIOS()

  // Hide volume control completely on iOS devices
  if (isIOS) {
    return null
  }

  return (
    <Stack
      spacing={2}
      direction="row"
      justifyContent={'center'}
      width={'100%'}
      sx={{ alignItems: 'center', mb: 1 }}
    >
      <VolumeMute fontSize="small" />
      <Slider
        aria-label={t('dashboard.volume')}
        valueLabelDisplay="auto"
        valueLabelFormat={(label: number | null) => `${(Number(label ?? 0) * 100).toFixed(0)}%`}
        value={volume}
        onChange={(_, newValue) => onVolumeChange(newValue as number)}
        min={0}
        max={1}
        step={0.01}
        sx={{ width: 200 }}
        size="small"
      />
      <VolumeUp fontSize="small" />
    </Stack>
  )
}

export default VolumeControl

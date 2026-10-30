import Slider from '@mui/material/Slider'
import { VolumeMute, VolumeUp } from '@mui/icons-material'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'

/** Props of the volume slider */
interface VolumeControlProps {
  /** The volume (0-1) */
  volume: number
  /** Whether the volume can be changed (false on iOS, where it is read-only) */
  controllable: boolean
  /** Called with the new volume */
  onVolumeChange: (volume: number) => void
}

/**
 * The volume slider, hidden where the volume cannot be changed, as on iOS, where the
 * hardware buttons control it (K13, ADR 0036).
 */
const VolumeControl = ({ volume, controllable, onVolumeChange }: VolumeControlProps) => {
  const { t } = useTranslation()

  if (!controllable) {
    return null
  }

  return (
    <Stack
      spacing={2}
      direction="row"
      sx={{
        justifyContent: 'center',
        width: '100%',
        alignItems: 'center',
        mb: 1,
      }}
    >
      <VolumeMute fontSize="small" />
      <Slider
        aria-label={t('playerPage.volume')}
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

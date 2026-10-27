import type { Ref } from 'react'
import IconButton from '@mui/material/IconButton'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import type { PlayerStatus } from 'src/types/player'
import Tooltip from '@mui/material/Tooltip'

interface PlayerControlsProps {
  /** Current playback status */
  status: PlayerStatus
  /** Whether the player is currently loading */
  loading: boolean
  /** Whether the button should be shown but non-interactive (e.g. welcome audio playing) */
  disabled?: boolean
  /** Callback function to start playback */
  onPlay: () => void
  /** Callback function to pause playback */
  onPause: () => void
  /** Ref to the button, so the dashboard can give it the focus (K58) */
  ref?: Ref<HTMLButtonElement>
}

/**
 * Player controls component
 * One stable play/pause button that changes state instead of unmounting, so it
 * keeps the focus (ADR 0051)
 *
 * - While loading: Pause, busy (`aria-busy`), with a hidden spinner in place of the icon
 * - Otherwise: Play unless the status is 'playing', then Pause
 * - When disabled: `aria-disabled` (still focusable) and clicks are ignored
 *
 * @param props - Component props
 * @returns The play/pause button
 */
const PlayerControls = ({
  status,
  loading,
  disabled,
  onPlay,
  onPause,
  ref,
}: PlayerControlsProps) => {
  const { t } = useTranslation()
  const showPause = loading || status === 'playing'
  const label = showPause ? t('dashboard.pause') : t('dashboard.play')
  const iconSx = { width: 64, height: 64, '& > svg': { width: 64, height: 64 } }

  return (
    <Tooltip title={label} placement="top" arrow>
      <IconButton
        ref={ref}
        onClick={() => {
          if (disabled) return
          if (showPause) onPause()
          else onPlay()
        }}
        aria-disabled={disabled}
        aria-busy={loading}
        size="large"
        aria-label={label}
        color="primary"
        // 16px around the 64px icon: as wide as the 96px grid column it
        // stretches to, so the hover and the spinner are round (spec 0016)
        sx={{
          p: 2,
          '&[aria-disabled="true"]': { color: 'action.disabled', cursor: 'default' },
        }}
      >
        {loading ? (
          <CircularProgress size={64} aria-hidden />
        ) : showPause ? (
          <PauseCircleIcon sx={iconSx} />
        ) : (
          <PlayCircleIcon sx={iconSx} />
        )}
      </IconButton>
    </Tooltip>
  )
}

export default PlayerControls

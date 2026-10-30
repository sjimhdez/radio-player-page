import { useState, type Ref } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import BedIcon from '@mui/icons-material/Bed'
import { useTranslation } from 'react-i18next'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'

/** Props of the sleep mode button */
interface SleepModeProps {
  /** Whether the live stream is playing (false during the welcome audio, K65) */
  isPlaying: boolean
  /** Called with the chosen duration in minutes */
  onSelect: (minutes: number) => void
  /** Ref to the button, so the player page can give it the focus (K58) */
  ref?: Ref<HTMLButtonElement>
}

/** The durations the menu offers, in minutes */
const SLEEP_OPTIONS = [30, 60, 120]

/**
 * The sleep mode button and its menu of durations. Always visible, and disabled when
 * playback is not active or the welcome audio plays: its handover to the live stream
 * goes through paused, which would cancel the timer (K65, ADR 0035). The countdown
 * lives in useSleepTimer(); this component only reports the chosen duration.
 */
const SleepMode = ({ isPlaying, onSelect, ref }: SleepModeProps) => {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSelectTime = (minutes: number) => {
    onSelect(minutes)
    handleClose()
  }

  return (
    <>
      <Stack
        sx={{
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        <Tooltip title={t('playerPage.sleepMode')} placement="top" arrow>
          <IconButton
            ref={ref}
            onClick={handleClick}
            aria-label={t('playerPage.sleepMode')}
            color="primary"
            disabled={!isPlaying}
          >
            <BedIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        sx={{
          zIndex: (theme) => theme.zIndex.tooltip,
        }}
      >
        {SLEEP_OPTIONS.map((minutes) => (
          <MenuItem
            key={minutes}
            onClick={() => handleSelectTime(minutes)}
            aria-label={t(`playerPage.sleepOption${minutes}`)}
          >
            {t(`playerPage.sleepOption${minutes}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default SleepMode

import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import BedIcon from '@mui/icons-material/Bed'
import { useTranslation } from 'react-i18next'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'

interface SleepModeProps {
  /** Whether the live stream is playing (false during the welcome audio, K65) */
  isPlaying: boolean
  /** Called with the chosen duration in minutes */
  onSelect: (minutes: number) => void
}

/** Available sleep timer duration options in minutes */
const SLEEP_OPTIONS = [30, 60, 120]

/**
 * Sleep mode component
 * Provides a button that opens a menu of sleep timer durations. The button is always
 * visible and disabled when playback is not active or the welcome audio plays: its
 * handover to the live stream goes through paused, which would cancel the timer
 * (known-issues.md K65, ADR 0035). The countdown itself lives in
 * useSleepTimer(); this component only reports the chosen duration.
 *
 * @param props - Component props
 * @returns Sleep mode button with duration menu (disabled when not playing)
 */
const SleepMode = ({ isPlaying, onSelect }: SleepModeProps) => {
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
        <Tooltip title={t('dashboard.sleepMode')} placement="top" arrow>
          <IconButton
            onClick={handleClick}
            aria-label={t('dashboard.sleepMode')}
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
            aria-label={t(`dashboard.sleepOption${minutes}`)}
          >
            {t(`dashboard.sleepOption${minutes}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default SleepMode

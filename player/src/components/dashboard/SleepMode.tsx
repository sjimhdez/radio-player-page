import { useState, useEffect, useRef } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import BedIcon from '@mui/icons-material/Bed'
import { useTranslation } from 'react-i18next'
import Stack from '@mui/material/Stack'

interface SleepModeProps {
  /** Whether the stream is currently playing */
  isPlaying: boolean
  /** Callback function called when sleep timer ends */
  onSleepTimerEnd: () => void
  /** Optional callback to notify parent of timer changes */
  onTimerChange?: (remainingSeconds: number | null) => void
  /** External timer state to sync with (used when timer is cancelled externally) */
  externalTimerSeconds?: number | null
}

/** Available sleep timer duration options in minutes */
const SLEEP_OPTIONS = [30, 60, 120]

/**
 * Sleep mode component
 * Provides a button to set a sleep timer that will pause playback after a specified duration.
 * The button is always visible and disabled when playback is not active.
 *
 * State synchronization flow:
 * 1. Internal state (remainingSeconds) tracks countdown locally
 * 2. Parent state (externalTimerSeconds) can cancel timer externally
 * 3. onTimerChange callback notifies parent of timer changes
 * 4. Timer automatically clears when playback is paused
 * 5. Timer calls onSleepTimerEnd when countdown reaches zero
 *
 * Multiple useEffect hooks manage:
 * - Timer interval lifecycle (start/stop/cleanup)
 * - Synchronization with external cancellation state
 * - Notification of parent component on state changes
 * - Prevention of stale closures in callbacks
 *
 * @param props - Component props
 * @returns Sleep mode button with duration menu (disabled when not playing)
 */
const SleepMode = ({
  isPlaying,
  onSleepTimerEnd,
  onTimerChange,
  externalTimerSeconds,
}: SleepModeProps) => {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onTimerChangeRef = useRef(onTimerChange)

  const open = Boolean(anchorEl)

  // Keep the most recent reference of onTimerChange to avoid stale closures
  useEffect(() => {
    onTimerChangeRef.current = onTimerChange
  }, [onTimerChange])

  // Clear interval and reset timer when playback is paused
  useEffect(() => {
    if (!isPlaying && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      setRemainingSeconds(null)
      onTimerChange?.(null)
    }
  }, [isPlaying, onTimerChange])

  useEffect(() => {
    if (remainingSeconds === null) {
      return
    }

    // Clear previous interval if it exists
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Update timer every second
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) {
          onTimerChangeRef.current?.(null)
          return null
        }
        // When timer reaches 0 or less, stop playback
        if (prev <= 1) {
          onSleepTimerEnd()
          onTimerChangeRef.current?.(null)
          return null
        }
        // Decrement timer and notify parent
        const newValue = prev - 1
        onTimerChangeRef.current?.(newValue)
        return newValue
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [remainingSeconds, onSleepTimerEnd])

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSelectTime = (minutes: number) => {
    const seconds = minutes * 60
    setRemainingSeconds(seconds)
    onTimerChange?.(seconds)
    handleClose()
  }

  // Sync with external state when timer is cancelled from parent component
  useEffect(() => {
    if (externalTimerSeconds === null && remainingSeconds !== null) {
      setRemainingSeconds(null)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [externalTimerSeconds, remainingSeconds])

  // Notify parent component of timer state changes
  useEffect(() => {
    onTimerChange?.(remainingSeconds)
  }, [remainingSeconds, onTimerChange])

  return (
    <>
      <Stack alignItems="flex-start" justifyContent="center">
        <IconButton
          onClick={handleClick}
          aria-label={t('dashboard.sleepMode')}
          color="primary"
          disabled={!isPlaying}
        >
          <BedIcon />
        </IconButton>
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

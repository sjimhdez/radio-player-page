import { useState, useEffect, useRef } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import { useTranslation } from 'react-i18next'

interface SleepModeProps {
  isPlaying: boolean
  onSleepTimerEnd: () => void
  onTimerChange?: (remainingSeconds: number | null) => void
  externalTimerSeconds?: number | null
}

const SLEEP_OPTIONS = [2, 30, 60, 120]

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

  // Mantener la referencia más reciente de onTimerChange
  useEffect(() => {
    onTimerChangeRef.current = onTimerChange
  }, [onTimerChange])

  // Limpiar intervalo cuando se pausa la reproducción
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

    // Limpiar intervalo anterior si existe
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) {
          onTimerChangeRef.current?.(null)
          return null
        }
        if (prev <= 1) {
          // Cuando llega a 0 o menos, detener la reproducción
          onSleepTimerEnd()
          onTimerChangeRef.current?.(null)
          return null
        }
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

  // Sincronizar con el estado externo cuando se cancela desde fuera
  useEffect(() => {
    if (externalTimerSeconds === null && remainingSeconds !== null) {
      setRemainingSeconds(null)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [externalTimerSeconds, remainingSeconds])

  // Notificar cambios en el temporizador
  useEffect(() => {
    onTimerChange?.(remainingSeconds)
  }, [remainingSeconds, onTimerChange])

  if (!isPlaying) {
    return null
  }

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        aria-label={t('dashboard.sleepMode')}
        color="primary"
        sx={{ paddingLeft: 1 }}
      >
        <BedtimeIcon />
      </IconButton>
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
      >
        {SLEEP_OPTIONS.map((minutes) => (
          <MenuItem key={minutes} onClick={() => handleSelectTime(minutes)}>
            {t(`dashboard.sleepOption${minutes}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default SleepMode

// One stable Play/Pause button (K56, ADR 0051).
import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import 'src/config/i18n'
import PlayerControls from 'src/components/PlayerControls'

const noop = () => {}

it('keeps the same button from idle through loading to playing (K56)', () => {
  const { rerender } = render(
    <PlayerControls status="idle" loading={false} onPlay={noop} onPause={noop} />,
  )
  const button = screen.getByRole('button', { name: 'Play' })

  rerender(<PlayerControls status="idle" loading onPlay={noop} onPause={noop} />)
  expect(screen.getByRole('button', { name: 'Pause' })).toBe(button)

  rerender(<PlayerControls status="playing" loading={false} onPlay={noop} onPause={noop} />)
  expect(screen.getByRole('button', { name: 'Pause' })).toBe(button)
})

it.each(['idle', 'paused', 'error'] as const)('shows Play when %s', (status) => {
  render(<PlayerControls status={status} loading={false} onPlay={noop} onPause={noop} />)

  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
})

it('marks the button busy while loading, with the spinner hidden (AX6)', () => {
  const onPause = vi.fn()
  render(<PlayerControls status="idle" loading onPlay={noop} onPause={onPause} />)
  const button = screen.getByRole('button', { name: 'Pause' })

  expect(button.getAttribute('aria-busy')).toBe('true')
  expect(screen.queryByRole('progressbar')).toBeNull()

  fireEvent.click(button)
  expect(onPause).toHaveBeenCalledOnce()
})

it('is not busy when not loading', () => {
  render(<PlayerControls status="playing" loading={false} onPlay={noop} onPause={noop} />)

  expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-busy')).toBe('false')
})

it('stays focusable but ignores clicks when disabled (welcome audio)', () => {
  const onPause = vi.fn()
  render(
    <PlayerControls status="playing" loading={false} disabled onPlay={noop} onPause={onPause} />,
  )
  const button = screen.getByRole('button', { name: 'Pause' })

  expect(button.getAttribute('aria-disabled')).toBe('true')
  expect(button.hasAttribute('disabled')).toBe(false)
  button.focus()
  expect(document.activeElement).toBe(button)

  fireEvent.click(button)
  expect(onPause).not.toHaveBeenCalled()
})

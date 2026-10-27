// Spec 0015 (task 1.11, H7): with hideTitle the station name stays as the h1, with its
// accessible name, but is hidden visually (ADR 0054).
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import 'src/config/i18n'
import StreamInfo from 'src/components/dashboard/StreamInfo'

vi.mock('src/hooks/use-program-schedule', () => ({
  default: () => ({ active: null, incoming: null }),
}))

function renderStreamInfo(hideTitle?: boolean) {
  render(
    <StreamInfo
      title="Radio One"
      logoImage="https://site.test/logo.png"
      isPlaying={false}
      canVisualize={false}
      loading={false}
      hideTitle={hideTitle}
    />,
  )
  return screen.getByRole('heading', { level: 1, name: 'Radio One' })
}

describe('StreamInfo title', () => {
  it('hides the h1 visually and keeps its accessible name with hideTitle', () => {
    const heading = renderStreamInfo(true)
    const style = getComputedStyle(heading)

    expect(heading.getAttribute('aria-hidden')).toBeNull()
    expect(style.position).toBe('absolute')
    expect(style.width).toBe('1px')
    expect(style.height).toBe('1px')
    expect(style.overflow).toBe('hidden')
    expect(style.whiteSpace).toBe('nowrap')
    // happy-dom does not compute the legacy clip; clip-path is its modern twin
    expect(style.clipPath).toBe('inset(50%)')
    expect(style.display).not.toBe('none')
    expect(style.visibility).not.toBe('hidden')
  })

  it.each([false, undefined])('shows the h1 with hideTitle %s', (hideTitle) => {
    const heading = renderStreamInfo(hideTitle)
    const style = getComputedStyle(heading)

    expect(heading.getAttribute('aria-hidden')).toBeNull()
    expect(style.position).not.toBe('absolute')
    expect(style.width).not.toBe('1px')
  })

  it('keeps the name in the alt of the logo with hideTitle', () => {
    renderStreamInfo(true)

    expect(screen.getByRole('img').getAttribute('alt')).toContain('Radio One')
  })
})

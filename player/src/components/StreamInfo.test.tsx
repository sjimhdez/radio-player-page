// With hideTitle the station name stays as the h1, with its accessible name, but is
// hidden visually (ADR 0054).
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import 'src/config/i18n'
import StreamInfo from 'src/components/StreamInfo'

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

// The current song, below the name and above the program, as plain text with a prefix
// only for screen readers, and never announced (ADR 0068).
describe('StreamInfo song', () => {
  function renderWithSong(song?: string | null) {
    render(
      <StreamInfo title="Radio One" isPlaying canVisualize={false} loading={false} song={song} />,
    )
  }

  const songLine = () =>
    Array.from(document.querySelectorAll('p')).find(
      (p) => p.querySelector('span')?.textContent === 'Now playing:',
    ) ?? null

  it.each([undefined, null])('has no line with the song %s', (song) => {
    renderWithSong(song)
    expect(songLine()).toBeNull()
  })

  it('shows the song below the name, with a prefix for screen readers', () => {
    renderWithSong('Bee Gees - You Win Again')
    const line = songLine()!
    expect(line.textContent).toBe('Now playing: Bee Gees - You Win Again')
    const prefix = line.querySelector('span')!
    expect(prefix.textContent).toBe('Now playing:')
    expect(getComputedStyle(prefix).clipPath).toBe('inset(50%)')
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is not announced: no live region and no status role', () => {
    renderWithSong('A - B')
    const line = songLine()!
    expect(line.closest('[aria-live]')).toBeNull()
    expect(line.closest('[role="status"]')).toBeNull()
  })

  it('shows markup from the server as text', () => {
    renderWithSong('<b>Bold</b> <img src=x onerror=alert(1)>')
    const line = songLine()!
    expect(line.querySelector('b, img')).toBeNull()
    expect(line.textContent).toContain('<b>Bold</b>')
  })
})

// The status region says it connects on the first load and while it reconnects, but not
// while the playing stream buffers (K60, K129).
describe('StreamInfo connecting', () => {
  function renderLoading(props: { isPlaying: boolean; loading: boolean; reconnecting?: boolean }) {
    render(<StreamInfo title="Radio One" logoImage={null} canVisualize={false} {...props} />)
    return screen.getByRole('status')
  }

  it('says it connects on the first load', () => {
    expect(renderLoading({ isPlaying: false, loading: true }).textContent).toBe('Connecting...')
  })

  it('says it connects while it reconnects, with the status still playing', () => {
    expect(renderLoading({ isPlaying: true, loading: true, reconnecting: true }).textContent).toBe(
      'Connecting...',
    )
  })

  it('says nothing while the playing stream buffers (K60)', () => {
    expect(renderLoading({ isPlaying: true, loading: true }).textContent).toBe('')
  })
})

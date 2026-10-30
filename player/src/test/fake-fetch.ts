// A fake fetch for the current song: answers by URL with Responses whose
// bodies record how much was read and whether they were cancelled.
import { vi } from 'vitest'

/** What a fake body records */
export interface FakeBody {
  /** Chunks pulled by the reader so far */
  pulled: number
  /** Whether the body was cancelled (the reader or the response gave up on it) */
  cancelled: boolean
}

/**
 * A body that sends chunks one per read, then closes; with endless, it repeats the
 * last chunk forever, as a live stream does.
 */
export function fakeBody(chunks: Uint8Array[], { endless = false } = {}) {
  const state: FakeBody = { pulled: 0, cancelled: false }
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[Math.min(state.pulled, chunks.length - 1)]
      if (state.pulled >= chunks.length && !endless) {
        controller.close()
        return
      }
      state.pulled += 1
      controller.enqueue(chunk)
    },
    cancel() {
      state.cancelled = true
    },
  })
  return { stream, state }
}

type Answer = Response | Error | (() => Response | Error)

/**
 * A fetch that answers each URL with its Response (or rejects with its Error); any
 * other URL rejects with a TypeError, as a request blocked by CORS does.
 */
export function createFakeFetch(answers: Record<string, Answer> = {}) {
  const fetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
    void init
    const answer = answers[url]
    const value = typeof answer === 'function' ? answer() : answer
    if (value === undefined) throw new TypeError('Failed to fetch')
    if (value instanceof Error) throw value
    return value
  })
  return { fetch, answers }
}

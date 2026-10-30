// Global setup for Vitest (happy-dom, ADR 0006). Per-test fakes such as the
// FakeAudioElement are installed by the tests that need them.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

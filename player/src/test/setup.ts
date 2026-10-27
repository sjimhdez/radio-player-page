// Global setup for Vitest (happy-dom, ADR 0006). Per-test fakes such as the
// FakeAudioElement arrive with the characterization tests in spec 0002.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

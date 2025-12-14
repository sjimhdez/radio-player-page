/**
 * Player status type
 * Represents the current state of the audio player
 *
 * - 'idle': Initial state, player has not been started
 * - 'playing': Audio is currently playing
 * - 'paused': Audio playback is paused
 * - 'error': An error occurred during playback
 */
export type PlayerStatus = 'idle' | 'playing' | 'error' | 'paused'

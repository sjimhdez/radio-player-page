// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  PARTICLE_COUNT: 50, // Number of particles
  PARTICLE_COLOR: 'rgba(19, 181, 210, 0.78)',
  PARTICLE_SIZE: 2, // Size of each particle in pixels
  MIN_RADIUS_PERCENT: 0.05, // Minimum radius as percentage of canvas (5%)
  MAX_RADIUS_PERCENT: 0.45, // Maximum radius as percentage of canvas (45%)
  ORBIT_SPEED: 0.03, // Rotation speed (radians per frame)
  SMOOTHING_FACTOR: 0.25, // Smoothing factor for radius changes (0-1, higher = faster)
  TRAIL_LENGTH: 60, // Trail length of each particle
  TRAIL_OPACITY: 0.3, // Trail opacity
  SENSITIVITY_MULTIPLIER: 2.5, // Audio sensitivity multiplier
} as const

// ============================================================================
// Types
// ============================================================================

interface Particle {
  angle: number // Current angle in orbit (in radians)
  baseRadius: number // Base radius of this particle
  currentRadius: number // Current radius (smoothed)
  targetRadius: number // Target radius based on audio
  speed: number // Individual rotation speed
  trail: Array<{ x: number; y: number }> // Previous positions for trail
  frequencyIndex: number // Frequency index associated with this particle
}

interface ParticlesState {
  particles: Particle[]
  canvasWidth: number
  canvasHeight: number
  centerX: number
  centerY: number
}

// ============================================================================
// Persistent State per Canvas
// ============================================================================

const particlesStateMap = new WeakMap<HTMLCanvasElement, ParticlesState>()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Initializes or resets the canvas state
 */
function initializeState(canvas: HTMLCanvasElement, width: number, height: number): ParticlesState {
  canvas.width = width
  canvas.height = height

  const centerX = width / 2
  const centerY = height / 2

  // Calculate radii based on canvas size
  const minDimension = Math.min(width, height)
  const minRadius = minDimension * CONFIG.MIN_RADIUS_PERCENT
  const maxRadius = minDimension * CONFIG.MAX_RADIUS_PERCENT

  // Create uniformly distributed particles
  const particles: Particle[] = []
  const angleStep = (Math.PI * 2) / CONFIG.PARTICLE_COUNT

  for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
    // Distribute initial angle uniformly
    const initialAngle = i * angleStep

    // Assign each particle to a different frequency band
    const frequencyIndex = Math.floor((i / CONFIG.PARTICLE_COUNT) * 1024) // Assuming ~1024 frequency points

    // Distribute base radii uniformly between min and max
    // This makes particles distribute in different orbits from the start
    const radiusProgress = i / CONFIG.PARTICLE_COUNT
    const baseRadius = minRadius + (maxRadius - minRadius) * radiusProgress

    particles.push({
      angle: initialAngle,
      baseRadius: baseRadius,
      currentRadius: baseRadius,
      targetRadius: baseRadius,
      speed: CONFIG.ORBIT_SPEED * (0.7 + Math.random() * 0.6), // Vary speed more (0.7x to 1.3x)
      trail: [],
      frequencyIndex,
    })
  }

  return {
    particles,
    canvasWidth: width,
    canvasHeight: height,
    centerX,
    centerY,
  }
}

/**
 * Calculates target radius for each particle based on frequency data
 */
function calculateTargetRadii(
  dataArray: Uint8Array,
  particles: Particle[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  const maxDataIndex = dataArray.length - 1
  const minDimension = Math.min(canvasWidth, canvasHeight)
  const minRadius = minDimension * CONFIG.MIN_RADIUS_PERCENT
  const maxRadius = minDimension * CONFIG.MAX_RADIUS_PERCENT
  const radiusRange = maxRadius - minRadius

  for (const particle of particles) {
    // Get frequency value corresponding to this particle
    const dataIndex = Math.min(particle.frequencyIndex, maxDataIndex)
    const amplitude = dataArray[dataIndex] // Value from 0-255

    // Normalize amplitude and apply sensitivity multiplier
    // Use a quadratic function to make response more sensitive
    const normalizedAmplitude = amplitude / 255
    const amplifiedAmplitude = Math.min(1.0, normalizedAmplitude * CONFIG.SENSITIVITY_MULTIPLIER)
    const squaredAmplitude = amplifiedAmplitude * amplifiedAmplitude // Quadratic function for more sensitivity

    // Calculate target radius: from base radius to maximum according to audio
    // Base radius is already distributed, now we expand it according to audio
    const audioInfluence = squaredAmplitude * radiusRange
    particle.targetRadius = particle.baseRadius + audioInfluence
  }
}

/**
 * Applies smoothing to current radius towards target radius
 */
function smoothRadius(currentRadius: number, targetRadius: number): number {
  return currentRadius + (targetRadius - currentRadius) * CONFIG.SMOOTHING_FACTOR
}

/**
 * Draws a particle with its trail
 */
function drawParticle(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  centerX: number,
  centerY: number,
): void {
  // Calculate current position
  const x = centerX + Math.cos(particle.angle) * particle.currentRadius
  const y = centerY + Math.sin(particle.angle) * particle.currentRadius

  // Add current position to trail
  particle.trail.push({ x, y })

  // Limit trail length
  if (particle.trail.length > CONFIG.TRAIL_LENGTH) {
    particle.trail.shift()
  }

  // Draw trail
  if (particle.trail.length > 1) {
    ctx.strokeStyle = CONFIG.PARTICLE_COLOR
    ctx.lineWidth = CONFIG.PARTICLE_SIZE
    ctx.globalAlpha = CONFIG.TRAIL_OPACITY

    ctx.beginPath()
    ctx.moveTo(particle.trail[0].x, particle.trail[0].y)

    for (let i = 1; i < particle.trail.length; i++) {
      ctx.lineTo(particle.trail[i].x, particle.trail[i].y)
    }

    ctx.stroke()
  }

  // Draw particle
  ctx.globalAlpha = 1.0
  ctx.fillStyle = CONFIG.PARTICLE_COLOR
  ctx.beginPath()
  ctx.arc(x, y, CONFIG.PARTICLE_SIZE, 0, Math.PI * 2)
  ctx.fill()
}

// ============================================================================
// Main Visualizer Function
// ============================================================================

export const particlesVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  // Get or initialize canvas state
  let state = particlesStateMap.get(canvas)

  // If canvas changed size or state doesn't exist, reinitialize
  if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
    state = initializeState(canvas, width, height)
    particlesStateMap.set(canvas, state)
  }

  // Update center in case size changed
  state.centerX = width / 2
  state.centerY = height / 2

  // Calculate target radii based on frequency data
  calculateTargetRadii(dataArray, state.particles, width, height)

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Update and draw each particle
  for (const particle of state.particles) {
    // Apply smoothing to radius
    particle.currentRadius = smoothRadius(particle.currentRadius, particle.targetRadius)

    // Update angle (rotation)
    particle.angle += particle.speed

    // Normalize angle to avoid overflow
    if (particle.angle > Math.PI * 2) {
      particle.angle -= Math.PI * 2
    }

    // Draw particle with its trail
    drawParticle(ctx, particle, state.centerX, state.centerY)
  }
}

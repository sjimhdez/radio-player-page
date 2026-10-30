import {
  createFrameStep,
  framesIn,
  REFERENCE_FRAME_MS,
  smoothingFor,
} from 'src/core/visualizers/frame-time'
import { createSpectrumLevels } from 'src/core/visualizers/levels'
import type { CreateVisualizer } from 'src/core/visualizers/types'

const CONFIG = {
  /** Particles around the center, each one a group of bands */
  PARTICLE_COUNT: 50,
  /** Color of the particles and their trails, the cyan of the oscilloscope */
  PARTICLE_COLOR: 'rgba(19, 181, 210, 0.78)',
  /** Radius of a particle and width of its trail, in CSS pixels */
  PARTICLE_SIZE: 2,
  /** Radius of the innermost orbit, as a share of the shorter side of the canvas */
  MIN_RADIUS_PERCENT: 0.05,
  /** Radius of the outermost orbit, as a share of the shorter side of the canvas */
  MAX_RADIUS_PERCENT: 0.45,
  /** Average speed of the orbits, in radians per 1/60 s */
  ORBIT_SPEED: 0.03,
  /** Share of the way to the target radius covered per 1/60 s (0–1, higher is faster) */
  SMOOTHING_FACTOR: 0.25,
  /** Length of each trail, in frames at 60 fps (1 s) */
  TRAIL_LENGTH: 60,
  /** Opacity of the trails, below that of the particles */
  TRAIL_OPACITY: 0.3,
} as const

interface Particle {
  /** Position on its orbit, in radians */
  angle: number
  /** Radius of its orbit in silence, in CSS pixels */
  baseRadius: number
  /** Radius drawn, in CSS pixels, gliding toward the target */
  currentRadius: number
  /** Radius its level asks for, in CSS pixels */
  targetRadius: number
  /** Its own speed, in radians per 1/60 s, so the particles do not move as one */
  speed: number
  /** Positions of the last second, with their frame time, oldest first */
  trail: Array<{ x: number; y: number; time: number }>
}

/** Drawing state of an instance, reset when the canvas changes size */
interface ParticlesState {
  particles: Particle[]
  canvasWidth: number
  canvasHeight: number
  centerX: number
  centerY: number
}

/**
 * A fresh state: the particles spread evenly around the center and from the
 * innermost to the outermost orbit, each with a random speed.
 */
function initializeState(width: number, height: number, random: () => number): ParticlesState {
  const centerX = width / 2
  const centerY = height / 2

  const minDimension = Math.min(width, height)
  const minRadius = minDimension * CONFIG.MIN_RADIUS_PERCENT
  const maxRadius = minDimension * CONFIG.MAX_RADIUS_PERCENT

  const particles: Particle[] = []
  const angleStep = (Math.PI * 2) / CONFIG.PARTICLE_COUNT

  for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
    const initialAngle = i * angleStep

    // Each particle on an orbit of its own from the start
    const radiusProgress = i / CONFIG.PARTICLE_COUNT
    const baseRadius = minRadius + (maxRadius - minRadius) * radiusProgress

    particles.push({
      angle: initialAngle,
      baseRadius: baseRadius,
      currentRadius: baseRadius,
      targetRadius: baseRadius,
      // From 0.7 to 1.3 times ORBIT_SPEED
      speed: CONFIG.ORBIT_SPEED * (0.7 + random() * 0.6),
      trail: [],
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
 * Sets the target radius of each particle from its level in 0–1: from its orbit
 * in silence out by up to the whole range of the orbits. Each particle reads its
 * own group of bands, so the 50 of them cover the spectrum.
 */
function calculateTargetRadii(
  levels: number[],
  particles: Particle[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  const minDimension = Math.min(canvasWidth, canvasHeight)
  const minRadius = minDimension * CONFIG.MIN_RADIUS_PERCENT
  const maxRadius = minDimension * CONFIG.MAX_RADIUS_PERCENT
  const radiusRange = maxRadius - minRadius

  particles.forEach((particle, i) => {
    particle.targetRadius = particle.baseRadius + levels[i] * radiusRange
  })
}

/** One step of the exponential smoothing from a radius toward its target */
function smoothRadius(currentRadius: number, targetRadius: number, factor: number): number {
  return currentRadius + (targetRadius - currentRadius) * factor
}

/**
 * Age, in milliseconds, at which a trail point is dropped: TRAIL_LENGTH frames at
 * 60 fps, less half a frame, so that 60 fps keeps 60 points despite the rounding
 * of the time.
 */
const TRAIL_MS = (CONFIG.TRAIL_LENGTH - 0.5) * REFERENCE_FRAME_MS

/** Adds the position of a particle to its trail, and draws the trail and the particle */
function drawParticle(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  centerX: number,
  centerY: number,
  time: number,
): void {
  const x = centerX + Math.cos(particle.angle) * particle.currentRadius
  const y = centerY + Math.sin(particle.angle) * particle.currentRadius

  particle.trail.push({ x, y, time })

  // The last second, at any frame rate (K119)
  while (time - particle.trail[0].time > TRAIL_MS) {
    particle.trail.shift()
  }

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

  ctx.globalAlpha = 1.0
  ctx.fillStyle = CONFIG.PARTICLE_COLOR
  ctx.beginPath()
  ctx.arc(x, y, CONFIG.PARTICLE_SIZE, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Particles: the spectrum as particles orbiting the center, each moving out with
 * the level of its bands and leaving a trail. The instance keeps the particles and
 * the levels of each.
 */
export const createParticlesVisualizer: CreateVisualizer = ({ random = Math.random } = {}) => {
  let state: ParticlesState | undefined
  const step = createFrameStep()
  const levels = createSpectrumLevels(CONFIG.PARTICLE_COUNT)

  return {
    draw(ctx, dataArray, { width, height, time }) {
      // The rotation and the smoothing follow the time since the previous frame (K119)
      const stepMs = step(time)
      const frames = framesIn(stepMs)
      const smoothing = smoothingFor(CONFIG.SMOOTHING_FACTOR, stepMs)

      if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
        state = initializeState(width, height, random)
      }

      state.centerX = width / 2
      state.centerY = height / 2

      calculateTargetRadii(levels(dataArray, stepMs), state.particles, width, height)

      ctx.clearRect(0, 0, width, height)

      for (const particle of state.particles) {
        particle.currentRadius = smoothRadius(
          particle.currentRadius,
          particle.targetRadius,
          smoothing,
        )

        particle.angle += particle.speed * frames

        // Kept within one turn, so the angle does not grow without end
        if (particle.angle > Math.PI * 2) {
          particle.angle -= Math.PI * 2
        }

        drawParticle(ctx, particle, state.centerX, state.centerY, time)
      }
    },
  }
}

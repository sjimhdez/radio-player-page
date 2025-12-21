// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  STAR_COUNT: 150,
  STAR_COLOR: 'rgba(255, 255, 255, 1)',
  MIN_STAR_SIZE: 0.5,
  MAX_STAR_SIZE: 3,
  SPEED: 30,
  DEPTH_RANGE: 2000,
  FOV: 500,
  FADE_IN_START_SCALE: 0.1,
  FADE_IN_END_SCALE: 0.3,
} as const

// ============================================================================
// Types
// ============================================================================

interface Star {
  x: number
  y: number
  z: number
}

interface StarfieldState {
  stars: Star[]
  canvasWidth: number
  canvasHeight: number
  centerX: number
  centerY: number
}

// ============================================================================
// Persistent State per Canvas
// ============================================================================

const starfieldStateMap = new WeakMap<HTMLCanvasElement, StarfieldState>()

// ============================================================================
// Helper Functions
// ============================================================================

function initializeState(canvas: HTMLCanvasElement, width: number, height: number): StarfieldState {
  canvas.width = width
  canvas.height = height

  const centerX = width / 2
  const centerY = height / 2

  const stars: Star[] = []
  for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
    stars.push({
      x: (Math.random() - 0.5) * width * 2,
      y: (Math.random() - 0.5) * height * 2,
      z: Math.random() * CONFIG.DEPTH_RANGE,
    })
  }

  return {
    stars,
    canvasWidth: width,
    canvasHeight: height,
    centerX,
    centerY,
  }
}

function project3DTo2D(
  x: number,
  y: number,
  z: number,
  centerX: number,
  centerY: number,
): { x: number; y: number; scale: number } {
  const scale = CONFIG.FOV / (CONFIG.FOV + z)
  const projectedX = centerX + x * scale
  const projectedY = centerY + y * scale
  return { x: projectedX, y: projectedY, scale }
}

function resetStar(star: Star, width: number, height: number): void {
  star.x = (Math.random() - 0.5) * width * 2
  star.y = (Math.random() - 0.5) * height * 2
  star.z = CONFIG.DEPTH_RANGE
}

function updateStars(stars: Star[], width: number, height: number): void {
  for (const star of stars) {
    star.z -= CONFIG.SPEED
    if (star.z <= 0) {
      resetStar(star, width, height)
    }
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  star: Star,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): void {
  // Project 3D to 2D
  const projected = project3DTo2D(star.x, star.y, star.z, centerX, centerY)

  // Skip if behind viewer
  if (projected.scale <= 0) {
    return
  }

  // Calculate star size
  const starSize =
    CONFIG.MIN_STAR_SIZE + (CONFIG.MAX_STAR_SIZE - CONFIG.MIN_STAR_SIZE) * (1 - projected.scale)

  // Calculate opacity: simple fade-in, then always 1.0
  let opacity = 1.0
  if (projected.scale < CONFIG.FADE_IN_END_SCALE) {
    if (projected.scale <= CONFIG.FADE_IN_START_SCALE) {
      opacity = 0
    } else {
      const fadeInRange = CONFIG.FADE_IN_END_SCALE - CONFIG.FADE_IN_START_SCALE
      const fadeInProgress = (projected.scale - CONFIG.FADE_IN_START_SCALE) / fadeInRange
      opacity = Math.max(0, Math.min(1, fadeInProgress))
    }
  }

  // Skip if invisible
  if (opacity <= 0) {
    return
  }

  // Check if star is completely OUTSIDE viewport
  // Star is completely outside if ALL of one edge is outside the canvas
  const leftEdge = projected.x - starSize
  const rightEdge = projected.x + starSize
  const topEdge = projected.y - starSize
  const bottomEdge = projected.y + starSize

  // Completely outside if: all left, all right, all top, or all bottom
  const isCompletelyOutside =
    rightEdge < 0 || // Completely to the left
    leftEdge > width || // Completely to the right
    bottomEdge < 0 || // Completely above
    topEdge > height // Completely below

  // Skip if completely outside
  if (isCompletelyOutside) {
    return
  }

  // Draw star (visible, opaque, at least partially in viewport)
  // Set alpha for this star only
  ctx.globalAlpha = opacity
  ctx.fillStyle = CONFIG.STAR_COLOR
  ctx.beginPath()
  ctx.arc(projected.x, projected.y, starSize, 0, Math.PI * 2)
  ctx.fill()
  // Reset alpha after drawing to prevent affecting next stars
  ctx.globalAlpha = 1.0
}

// ============================================================================
// Main Visualizer Function
// ============================================================================

/**
 * Starfield visualizer
 * Creates a 3D starfield effect where stars move toward the viewer
 * Stars are projected from 3D space to 2D canvas using perspective projection
 * Creates a classic "warp speed" or tunnel effect
 *
 * @param ctx - Canvas 2D rendering context
 * @param dataArray - Not used (decorative visualizer)
 * @param canvas - HTML canvas element
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 */
export const starfieldVisualizer = (
  ctx: CanvasRenderingContext2D,
  _dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  let state = starfieldStateMap.get(canvas)

  if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
    state = initializeState(canvas, width, height)
    starfieldStateMap.set(canvas, state)
  }

  state.centerX = width / 2
  state.centerY = height / 2

  updateStars(state.stars, width, height)

  ctx.clearRect(0, 0, width, height)

  const sortedStars = [...state.stars].sort((a, b) => b.z - a.z)

  for (const star of sortedStars) {
    drawStar(ctx, star, state.centerX, state.centerY, width, height)
  }

  ctx.globalAlpha = 1.0
}

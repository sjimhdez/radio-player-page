// ============================================================================
// Constantes de configuración
// ============================================================================

const CONFIG = {
  PARTICLE_COUNT: 50, // Número de partículas
  PARTICLE_COLOR: '#1a82d6',
  PARTICLE_SIZE: 2, // Tamaño de cada partícula en píxeles
  MIN_RADIUS_PERCENT: 0.05, // Radio mínimo como porcentaje del canvas (5%)
  MAX_RADIUS_PERCENT: 0.45, // Radio máximo como porcentaje del canvas (45%)
  ORBIT_SPEED: 0.03, // Velocidad de rotación (radianes por frame)
  SMOOTHING_FACTOR: 0.25, // Factor de suavizado para cambios de radio (0-1, mayor = más rápido)
  TRAIL_LENGTH: 60, // Longitud de la estela de cada partícula
  TRAIL_OPACITY: 0.3, // Opacidad de la estela
  SENSITIVITY_MULTIPLIER: 2.5, // Multiplicador de sensibilidad al audio
} as const

// ============================================================================
// Tipos
// ============================================================================

interface Particle {
  angle: number // Ángulo actual en la órbita (en radianes)
  baseRadius: number // Radio base de esta partícula
  currentRadius: number // Radio actual (suavizado)
  targetRadius: number // Radio objetivo basado en el audio
  speed: number // Velocidad de rotación individual
  trail: Array<{ x: number; y: number }> // Posiciones anteriores para la estela
  frequencyIndex: number // Índice de frecuencia asociado a esta partícula
}

interface ParticlesState {
  particles: Particle[]
  canvasWidth: number
  canvasHeight: number
  centerX: number
  centerY: number
}

// ============================================================================
// Estado persistente por canvas
// ============================================================================

const particlesStateMap = new WeakMap<HTMLCanvasElement, ParticlesState>()

// ============================================================================
// Funciones auxiliares
// ============================================================================

/**
 * Inicializa o reinicia el estado del canvas
 */
function initializeState(canvas: HTMLCanvasElement, width: number, height: number): ParticlesState {
  canvas.width = width
  canvas.height = height

  const centerX = width / 2
  const centerY = height / 2

  // Calcular radios basados en el tamaño del canvas
  const minDimension = Math.min(width, height)
  const minRadius = minDimension * CONFIG.MIN_RADIUS_PERCENT
  const maxRadius = minDimension * CONFIG.MAX_RADIUS_PERCENT

  // Crear partículas distribuidas uniformemente
  const particles: Particle[] = []
  const angleStep = (Math.PI * 2) / CONFIG.PARTICLE_COUNT

  for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
    // Distribuir el ángulo inicial uniformemente
    const initialAngle = i * angleStep

    // Asignar cada partícula a una banda de frecuencia diferente
    const frequencyIndex = Math.floor((i / CONFIG.PARTICLE_COUNT) * 1024) // Asumiendo ~1024 puntos de frecuencia

    // Distribuir los radios base de manera uniforme entre min y max
    // Esto hace que las partículas se distribuyan en diferentes órbitas desde el inicio
    const radiusProgress = i / CONFIG.PARTICLE_COUNT
    const baseRadius = minRadius + (maxRadius - minRadius) * radiusProgress

    particles.push({
      angle: initialAngle,
      baseRadius: baseRadius,
      currentRadius: baseRadius,
      targetRadius: baseRadius,
      speed: CONFIG.ORBIT_SPEED * (0.7 + Math.random() * 0.6), // Variar velocidad más (0.7x a 1.3x)
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
 * Calcula el radio objetivo para cada partícula basado en los datos de frecuencia
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
    // Obtener el valor de frecuencia correspondiente a esta partícula
    const dataIndex = Math.min(particle.frequencyIndex, maxDataIndex)
    const amplitude = dataArray[dataIndex] // Valor de 0-255

    // Normalizar amplitud y aplicar multiplicador de sensibilidad
    // Usar una función cuadrática para hacer la respuesta más sensible
    const normalizedAmplitude = amplitude / 255
    const amplifiedAmplitude = Math.min(1.0, normalizedAmplitude * CONFIG.SENSITIVITY_MULTIPLIER)
    const squaredAmplitude = amplifiedAmplitude * amplifiedAmplitude // Función cuadrática para más sensibilidad

    // Calcular radio objetivo: desde el radio base hasta el máximo según el audio
    // El radio base ya está distribuido, ahora lo expandimos según el audio
    const audioInfluence = squaredAmplitude * radiusRange
    particle.targetRadius = particle.baseRadius + audioInfluence
  }
}

/**
 * Aplica suavizado al radio actual hacia el radio objetivo
 */
function smoothRadius(currentRadius: number, targetRadius: number): number {
  return currentRadius + (targetRadius - currentRadius) * CONFIG.SMOOTHING_FACTOR
}

/**
 * Dibuja una partícula con su estela
 */
function drawParticle(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  centerX: number,
  centerY: number,
): void {
  // Calcular posición actual
  const x = centerX + Math.cos(particle.angle) * particle.currentRadius
  const y = centerY + Math.sin(particle.angle) * particle.currentRadius

  // Agregar posición actual a la estela
  particle.trail.push({ x, y })

  // Limitar la longitud de la estela
  if (particle.trail.length > CONFIG.TRAIL_LENGTH) {
    particle.trail.shift()
  }

  // Dibujar estela
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

  // Dibujar partícula
  ctx.globalAlpha = 1.0
  ctx.fillStyle = CONFIG.PARTICLE_COLOR
  ctx.beginPath()
  ctx.arc(x, y, CONFIG.PARTICLE_SIZE, 0, Math.PI * 2)
  ctx.fill()
}

// ============================================================================
// Función principal del visualizador
// ============================================================================

export const particlesVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  // Obtener o inicializar el estado del canvas
  let state = particlesStateMap.get(canvas)

  // Si el canvas cambió de tamaño o no existe estado, reinicializar
  if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
    state = initializeState(canvas, width, height)
    particlesStateMap.set(canvas, state)
  }

  // Actualizar centro por si cambió el tamaño
  state.centerX = width / 2
  state.centerY = height / 2

  // Calcular radios objetivo basados en los datos de frecuencia
  calculateTargetRadii(dataArray, state.particles, width, height)

  // Limpiar el canvas
  ctx.clearRect(0, 0, width, height)

  // Actualizar y dibujar cada partícula
  for (const particle of state.particles) {
    // Aplicar suavizado al radio
    particle.currentRadius = smoothRadius(particle.currentRadius, particle.targetRadius)

    // Actualizar ángulo (rotación)
    particle.angle += particle.speed

    // Normalizar ángulo para evitar overflow
    if (particle.angle > Math.PI * 2) {
      particle.angle -= Math.PI * 2
    }

    // Dibujar partícula con su estela
    drawParticle(ctx, particle, state.centerX, state.centerY)
  }
}

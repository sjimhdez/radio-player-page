// ============================================================================
// Constantes de configuración
// ============================================================================

const CONFIG = {
  BAR_COUNT: 13,
  // BAR_COLOR: '#1a82d6',
  BAR_COLOR: '#333',
  SMOOTHING_FACTOR: 0.15, // Factor de suavizado (0-1, menor = más suave)
  BAR_SPACING: 2, // Espacio entre barras en píxeles
  UPDATE_INTERVAL_MS: 50, // Intervalo entre actualizaciones de altura objetivo
  MAX_AMPLITUDE: 255, // Máxima amplitud posible (rango de datos de frecuencia: 0-255)
  PEAK_DURATION_MS: 4000, // Duración de la línea de pico en milisegundos
  PEAK_COLOR: '#666', // Color de la línea de pico
  PEAK_LINE_WIDTH: 2, // Grosor de la línea de pico
} as const

// ============================================================================
// Tipos
// ============================================================================

interface Peak {
  barIndex: number // Índice de la barra
  peakHeight: number // Altura del pico
  timestamp: number // Tiempo cuando se detectó el pico
  x: number // Posición X de la barra
  barWidth: number // Ancho de la barra
}

interface BarState {
  smoothedHeights: number[] // Alturas suavizadas actuales
  targetHeights: number[] // Alturas objetivo calculadas
  previousHeights: number[] // Alturas anteriores para detectar picos
  peaks: Peak[] // Array de picos activos
  canvasWidth: number
  canvasHeight: number
  lastUpdateTime: number
}

// ============================================================================
// Estado persistente por canvas
// ============================================================================

const barStateMap = new WeakMap<HTMLCanvasElement, BarState>()

// ============================================================================
// Funciones auxiliares
// ============================================================================

/**
 * Inicializa o reinicia el estado del canvas
 */
function initializeState(canvas: HTMLCanvasElement, width: number, height: number): BarState {
  canvas.width = width
  canvas.height = height

  // Con efecto espejo: se muestran exactamente N barras (no 2N-1)
  return {
    smoothedHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    targetHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    previousHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    peaks: [],
    canvasWidth: width,
    canvasHeight: height,
    lastUpdateTime: Date.now(),
  }
}

/**
 * Calcula la amplitud promedio para un rango de datos de frecuencia
 * Los datos de frecuencia ya vienen en rango 0-255, donde cada valor
 * representa la amplitud de una banda de frecuencia específica
 * Retorna un valor de 0 a 255 representando la amplitud promedio
 */
function calculateAverageAmplitude(
  dataArray: Uint8Array,
  startIdx: number,
  endIdx: number,
): number {
  let sumAmplitude = 0
  const count = endIdx - startIdx

  for (let i = startIdx; i < endIdx; i++) {
    // Los datos de frecuencia ya vienen como amplitud (0-255)
    sumAmplitude += dataArray[i]
  }

  return sumAmplitude / count
}

/**
 * Convierte una amplitud (0-255) a altura de barra en píxeles (0-100% del canvas)
 * Escala lineal: amplitud 0 = 0% altura, amplitud 255 = 100% altura
 * Fórmula simplificada: altura = (amplitud / 255) * canvasHeight
 */
function amplitudeToHeight(amplitude: number, canvasHeight: number): number {
  // Asegurar que la amplitud esté en el rango válido (0-255)
  const clampedAmplitude = Math.max(0, Math.min(amplitude, CONFIG.MAX_AMPLITUDE))

  // Convertir directamente de escala 0-255 a altura del canvas (0-100%)
  return (clampedAmplitude / CONFIG.MAX_AMPLITUDE) * canvasHeight
}

/**
 * Calcula las alturas objetivo para todas las barras basadas en los datos de frecuencia
 * Cada barra representa una banda de frecuencia del audio (de graves a agudos)
 * Convierte datos de amplitud (0-255) a altura del canvas (0-100%)
 * Aplica efecto espejo: se muestran exactamente N barras con patrón simétrico
 */
function calculateTargetHeights(dataArray: Uint8Array, canvasHeight: number): number[] {
  const dataPointsPerBar = Math.floor(dataArray.length / CONFIG.BAR_COUNT)
  const sourceHeights: number[] = []

  // Primero calcular las alturas de las barras de datos originales
  for (let i = 0; i < CONFIG.BAR_COUNT; i++) {
    const startIdx = i * dataPointsPerBar
    const endIdx = Math.min(startIdx + dataPointsPerBar, dataArray.length)

    // Calcular amplitud promedio para esta banda de frecuencia (rango: 0-255)
    const averageAmplitude = calculateAverageAmplitude(dataArray, startIdx, endIdx)

    // Convertir amplitud (0-255) a altura del canvas (0-100% de canvasHeight)
    sourceHeights[i] = amplitudeToHeight(averageAmplitude, canvasHeight)
  }

  // Aplicar efecto espejo: crear patrón completo y recortar proporcionalmente desde los extremos
  // Patrón completo: [último, penúltimo, ..., segundo, primero, segundo, ..., penúltimo, último]
  const N = sourceHeights.length
  const mirroredHeights: number[] = []

  // Crear el patrón espejo completo (2N-1 barras)
  // Mitad izquierda (reflejo invertido): desde el último hasta el segundo
  for (let i = N - 1; i >= 1; i--) {
    mirroredHeights.push(sourceHeights[i])
  }

  // Centro: primer dato (graves)
  mirroredHeights.push(sourceHeights[0])

  // Mitad derecha (reflejo): desde el segundo hasta el último
  for (let i = 1; i < N; i++) {
    mirroredHeights.push(sourceHeights[i])
  }

  // Ahora tenemos 2N-1 barras, pero queremos exactamente N barras
  // Recortamos proporcionalmente desde los extremos para mantener centrado
  const totalBars = mirroredHeights.length // 2N-1
  const barsToRemove = totalBars - N // N-1 barras a eliminar
  const removeFromLeft = Math.floor(barsToRemove / 2)
  const removeFromRight = barsToRemove - removeFromLeft // Si es impar, una más de un lado

  // Recortar desde los extremos
  return mirroredHeights.slice(removeFromLeft, totalBars - removeFromRight)
}

/**
 * Aplica suavizado a una altura actual hacia una altura objetivo
 */
function smoothHeight(currentHeight: number, targetHeight: number): number {
  return currentHeight + (targetHeight - currentHeight) * CONFIG.SMOOTHING_FACTOR
}

/**
 * Calcula las dimensiones y posiciones de las barras
 * Con efecto espejo: se muestran exactamente N barras
 */
function calculateBarDimensions(
  canvasWidth: number,
  visualBarCount: number,
): { barWidth: number; barPositions: number[] } {
  const totalSpacing = CONFIG.BAR_SPACING * (visualBarCount - 1)
  const availableWidth = canvasWidth - totalSpacing
  const barWidth = availableWidth / visualBarCount

  const barPositions: number[] = []
  for (let i = 0; i < visualBarCount; i++) {
    barPositions[i] = i * (barWidth + CONFIG.BAR_SPACING)
  }

  return { barWidth, barPositions }
}

/**
 * Dibuja una barra individual en el canvas
 */
function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  barWidth: number,
  barHeight: number,
  canvasHeight: number,
): void {
  // Limpiar solo el área vertical de esta barra
  ctx.clearRect(x, 0, barWidth, canvasHeight)

  // Dibujar la barra desde abajo hacia arriba
  ctx.fillStyle = CONFIG.BAR_COLOR
  ctx.fillRect(x, canvasHeight - barHeight, barWidth, barHeight)
}

/**
 * Dibuja una línea de pico en el canvas
 */
function drawPeakLine(ctx: CanvasRenderingContext2D, peak: Peak, canvasHeight: number): void {
  const y = canvasHeight - peak.peakHeight

  ctx.strokeStyle = CONFIG.PEAK_COLOR
  ctx.lineWidth = CONFIG.PEAK_LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(peak.x, y)
  ctx.lineTo(peak.x + peak.barWidth, y)
  ctx.stroke()
}

/**
 * Detecta nuevos picos comparando alturas actuales con anteriores
 * Un pico se detecta cuando la altura anterior era mayor que la actual,
 * lo que indica que la barra alcanzó un máximo y ahora está disminuyendo
 * Solo crea un nuevo pico si supera la altura del pico actualmente marcado para esa barra
 */
function detectPeaks(
  currentHeights: number[],
  previousHeights: number[],
  barPositions: number[],
  barWidth: number,
  now: number,
  existingPeaks: Peak[],
): Peak[] {
  const newPeaks: Peak[] = []

  for (let i = 0; i < currentHeights.length; i++) {
    // Detectar pico: la altura anterior era mayor que la actual
    // Esto indica que la barra alcanzó un máximo local y ahora está disminuyendo
    if (
      previousHeights[i] > currentHeights[i] &&
      previousHeights[i] > 5 // Mínimo umbral para considerar un pico (en píxeles)
    ) {
      // Buscar si ya existe un pico activo para esta barra
      const existingPeak = existingPeaks.find((peak) => peak.barIndex === i)

      // Solo crear un nuevo pico si:
      // 1. No existe un pico activo para esta barra, O
      // 2. El nuevo pico es mayor que el pico existente
      if (!existingPeak || previousHeights[i] > existingPeak.peakHeight) {
        newPeaks.push({
          barIndex: i,
          peakHeight: previousHeights[i],
          timestamp: now,
          x: barPositions[i],
          barWidth: barWidth,
        })
      }
    }
  }

  return newPeaks
}

/**
 * Limpia los picos que han expirado (más de PEAK_DURATION_MS)
 */
function cleanExpiredPeaks(peaks: Peak[], now: number): Peak[] {
  return peaks.filter((peak) => now - peak.timestamp < CONFIG.PEAK_DURATION_MS)
}

// ============================================================================
// Función principal del visualizador
// ============================================================================

export const barVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  // Obtener o inicializar el estado del canvas
  let state = barStateMap.get(canvas)

  // Si el canvas cambió de tamaño o no existe estado, reinicializar
  if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
    state = initializeState(canvas, width, height)
    barStateMap.set(canvas, state)
  }

  // Calcular alturas objetivo solo si ha pasado el intervalo de tiempo
  const now = Date.now()
  const shouldUpdateTargets = now - state.lastUpdateTime >= CONFIG.UPDATE_INTERVAL_MS

  if (shouldUpdateTargets) {
    state.targetHeights = calculateTargetHeights(dataArray, height)
    state.lastUpdateTime = now
  }

  // Con efecto espejo: se muestran exactamente N barras
  const visualBarCount = CONFIG.BAR_COUNT

  // Calcular dimensiones de las barras
  const { barWidth, barPositions } = calculateBarDimensions(width, visualBarCount)

  // Limpiar picos expirados
  state.peaks = cleanExpiredPeaks(state.peaks, now)

  // En cada frame: aplicar suavizado y dibujar todas las barras
  for (let i = 0; i < visualBarCount; i++) {
    // Aplicar suavizado hacia la altura objetivo
    state.smoothedHeights[i] = smoothHeight(state.smoothedHeights[i], state.targetHeights[i])

    // Dibujar la barra
    drawBar(ctx, barPositions[i], barWidth, state.smoothedHeights[i], height)
  }

  // Detectar nuevos picos comparando alturas actuales con anteriores
  // Solo se crean nuevos picos si superan a los picos actualmente marcados
  const newPeaks = detectPeaks(
    state.smoothedHeights,
    state.previousHeights,
    barPositions,
    barWidth,
    now,
    state.peaks,
  )

  // Reemplazar picos existentes si los nuevos son mayores
  for (const newPeak of newPeaks) {
    const existingIndex = state.peaks.findIndex((peak) => peak.barIndex === newPeak.barIndex)
    if (existingIndex >= 0) {
      // Reemplazar el pico existente con el nuevo (que es mayor)
      state.peaks[existingIndex] = newPeak
    } else {
      // Agregar nuevo pico si no existe uno para esta barra
      state.peaks.push(newPeak)
    }
  }

  // Actualizar alturas anteriores para la próxima detección
  state.previousHeights = [...state.smoothedHeights]

  // Dibujar líneas de picos activos
  for (const peak of state.peaks) {
    // Actualizar posición X y ancho por si el canvas cambió de tamaño
    peak.x = barPositions[peak.barIndex]
    peak.barWidth = barWidth
    drawPeakLine(ctx, peak, height)
  }
}

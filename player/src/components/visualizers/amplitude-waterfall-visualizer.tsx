// ============================================================================
// Constantes de configuración
// ============================================================================

const CONFIG = {
  COLUMN_WIDTH: 2, // Ancho de cada columna en píxeles
  SCROLL_SPEED: 1, // Velocidad de desplazamiento del waterfall (columnas por frame)
  WAVEFORM_COLOR: 'rgba(255, 255, 255, 0.3)', // Color fijo para todas las líneas verticales
  SMOOTHING_FACTOR: 0.3, // Factor de suavizado para cambios de amplitud (0-1)
} as const

// ============================================================================
// Tipos
// ============================================================================

interface AmplitudeWaterfallState {
  canvasWidth: number
  canvasHeight: number
  dataPoints: number // Número de puntos de datos de amplitud
  columns: number[] // Array de columnas del waterfall, cada una contiene la amplitud promedio en ese momento
  smoothedColumns: number[] // Columnas suavizadas para transiciones más suaves
}

// ============================================================================
// Estado persistente por canvas
// ============================================================================

const amplitudeWaterfallStateMap = new WeakMap<HTMLCanvasElement, AmplitudeWaterfallState>()

// ============================================================================
// Funciones auxiliares
// ============================================================================

/**
 * Inicializa o reinicia el estado del canvas para el waterfall de amplitud
 */
function initializeState(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dataPoints: number,
): AmplitudeWaterfallState {
  canvas.width = width
  canvas.height = height

  const columnCount = Math.ceil(width / CONFIG.COLUMN_WIDTH)

  // Inicializar arrays de columnas del waterfall con amplitud cero
  const columns: number[] = new Array(columnCount).fill(0)
  const smoothedColumns: number[] = new Array(columnCount).fill(0)

  return {
    canvasWidth: width,
    canvasHeight: height,
    dataPoints,
    columns,
    smoothedColumns,
  }
}

/**
 * Calcula la amplitud promedio de los datos de tiempo
 * Los datos de tiempo están en rango 0-255, donde 128 es el centro (sin señal)
 */
function calculateAmplitude(timeData: Uint8Array): number {
  let sum = 0
  let maxDeviation = 0

  for (let i = 0; i < timeData.length; i++) {
    // Calcular la desviación desde el centro (128)
    const deviation = Math.abs(timeData[i] - 128)
    sum += deviation
    maxDeviation = Math.max(maxDeviation, deviation)
  }

  // Usar el promedio de desviación, pero escalado para que sea más sensible
  const averageDeviation = sum / timeData.length
  // Normalizar a 0-255, usando el máximo de desviación posible (128)
  return Math.min(255, (averageDeviation / 128) * 255)
}

/**
 * Dibuja una columna del waterfall de amplitud en el canvas
 * Muestra la amplitud como una línea vertical centrada con efecto waterfall
 */
function drawColumn(
  ctx: CanvasRenderingContext2D,
  amplitude: number,
  x: number,
  columnWidth: number,
  canvasHeight: number,
): void {
  // Normalizar amplitud (0-255) a altura (0 a canvasHeight/2)
  const normalizedAmplitude = amplitude / 255
  const barHeight = (normalizedAmplitude * canvasHeight) / 2

  // Calcular posición centrada verticalmente
  const centerY = canvasHeight / 2
  const topY = centerY - barHeight
  const totalHeight = barHeight * 2

  // Dibujar la barra de amplitud completa (centrada) con color fijo
  ctx.fillStyle = CONFIG.WAVEFORM_COLOR
  ctx.fillRect(x, topY, columnWidth, totalHeight)
}

/**
 * Actualiza el waterfall de amplitud desplazando las columnas y agregando una nueva
 */
function updateWaterfall(state: AmplitudeWaterfallState, newTimeData: Uint8Array): void {
  const columnCount = state.columns.length

  // Desplazar todas las columnas del waterfall hacia la izquierda
  for (let i = 0; i < columnCount - CONFIG.SCROLL_SPEED; i++) {
    state.columns[i] = state.columns[i + CONFIG.SCROLL_SPEED]
    state.smoothedColumns[i] = state.smoothedColumns[i + CONFIG.SCROLL_SPEED]
  }

  // Calcular la amplitud promedio de los datos de tiempo actuales
  const newAmplitude = calculateAmplitude(newTimeData)

  // Aplicar suavizado a la nueva amplitud usando la última columna suavizada como referencia
  const lastSmoothedAmplitude =
    state.smoothedColumns[columnCount - CONFIG.SCROLL_SPEED] || newAmplitude
  const smoothedNewAmplitude =
    lastSmoothedAmplitude + (newAmplitude - lastSmoothedAmplitude) * CONFIG.SMOOTHING_FACTOR

  // Agregar la nueva columna al final del waterfall
  for (let i = 0; i < CONFIG.SCROLL_SPEED; i++) {
    const insertIndex = columnCount - CONFIG.SCROLL_SPEED + i
    if (insertIndex < columnCount) {
      state.columns[insertIndex] = newAmplitude
      state.smoothedColumns[insertIndex] = smoothedNewAmplitude
    }
  }
}

// ============================================================================
// Función principal del visualizador
// ============================================================================

export const amplitudeWaterfallVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  // Obtener o inicializar el estado del canvas
  let state = amplitudeWaterfallStateMap.get(canvas)
  const dataPoints = dataArray.length

  // Si el canvas cambió de tamaño, el número de puntos cambió, o no existe estado, reinicializar
  if (
    !state ||
    state.canvasWidth !== width ||
    state.canvasHeight !== height ||
    state.dataPoints !== dataPoints
  ) {
    state = initializeState(canvas, width, height, dataPoints)
    amplitudeWaterfallStateMap.set(canvas, state)
  }

  // Actualizar el waterfall de amplitud con los nuevos datos de tiempo
  updateWaterfall(state, dataArray)

  // Limpiar el canvas
  ctx.clearRect(0, 0, width, height)

  // Dibujar todas las columnas del waterfall de amplitud
  const columnCount = state.columns.length
  for (let i = 0; i < columnCount; i++) {
    const x = i * CONFIG.COLUMN_WIDTH
    if (x < width) {
      drawColumn(ctx, state.smoothedColumns[i], x, CONFIG.COLUMN_WIDTH, height)
    }
  }
}

// ============================================================================
// Constantes de configuración
// ============================================================================

const CONFIG = {
  WAVE_COLOR: '#1a82d6', // Color de la onda del osciloscopio
  AXIS_COLOR: '#555', // Color del eje central
  AXIS_LINE_WIDTH: 1, // Grosor de la línea del eje central en píxeles
  WAVE_LINE_WIDTH: 2, // Grosor de la línea de la onda en píxeles
  DATA_CENTER_VALUE: 128, // Valor central de los datos de tiempo (0-255, donde 128 es sin señal)
} as const

// ============================================================================
// Funciones auxiliares
// ============================================================================

/**
 * Calcula la posición Y de un punto de la onda basado en el valor de datos
 * Los datos de tiempo están en rango 0-255, donde 128 es el centro (sin señal)
 * La onda se dibuja centrada verticalmente en el canvas
 */
function calculateWaveY(dataValue: number, centerY: number, canvasHeight: number): number {
  // Normalizar el valor de datos desde el centro (128)
  // dataValue - 128 da un rango de -128 a 127
  // Dividir por 128 normaliza a -1 a ~1
  // Multiplicar por (height / 2) escala a la mitad de la altura del canvas
  let y =
    centerY -
    ((dataValue - CONFIG.DATA_CENTER_VALUE) / CONFIG.DATA_CENTER_VALUE) * (canvasHeight / 2)

  // Asegurar que Y esté dentro de los límites del canvas
  y = Math.min(canvasHeight, Math.max(0, Math.round(y)))

  return y
}

/**
 * Dibuja el eje central horizontal del osciloscopio
 */
function drawCenterAxis(ctx: CanvasRenderingContext2D, width: number, centerY: number): void {
  ctx.strokeStyle = CONFIG.AXIS_COLOR
  ctx.lineWidth = CONFIG.AXIS_LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()
}

/**
 * Dibuja la onda del osciloscopio basada en los datos de tiempo
 */
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  width: number,
  centerY: number,
  height: number,
): void {
  ctx.strokeStyle = CONFIG.WAVE_COLOR
  ctx.lineWidth = CONFIG.WAVE_LINE_WIDTH
  ctx.beginPath()

  const sliceWidth = width / dataArray.length

  for (let i = 0; i < dataArray.length; i++) {
    const x = i * sliceWidth
    const y = calculateWaveY(dataArray[i], centerY, height)

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()
}

// ============================================================================
// Función principal del visualizador
// ============================================================================

export const oscilloscopeVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  canvas.width = width
  canvas.height = height

  const centerY = height / 2

  ctx.clearRect(0, 0, width, height)

  // Dibujar eje central
  drawCenterAxis(ctx, width, centerY)

  // Dibujar onda
  drawWaveform(ctx, dataArray, width, centerY, height)
}

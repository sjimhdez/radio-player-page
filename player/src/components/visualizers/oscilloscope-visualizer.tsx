export const oscilloscopeVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
) => {
  const width = 1500
  const height = 300
  canvas.width = width
  canvas.height = height

  const centerY = height / 2
  const color = '#1a82d6'

  ctx.clearRect(0, 0, width, height)

  // Dibuja eje central
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()

  // Dibujo onda
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()

  const sliceWidth = width / dataArray.length

  for (let i = 0; i < dataArray.length; i++) {
    const x = i * sliceWidth
    let y = centerY - ((dataArray[i] - 128) / 128) * (height / 2)
    y = Math.min(height, Math.max(0, Math.round(y)))

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()
}

export const barVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  canvas.width = width
  canvas.height = height

  const color = '#1a82d6'
  const barCount = dataArray.length
  const barWidth = width / barCount
  const maxBarHeight = height

  ctx.clearRect(0, 0, width, height)

  // Draw vertical bars
  for (let i = 0; i < barCount; i++) {
    const dataValue = dataArray[i]
    // Normalize the value (0-255) to bar height (0-height)
    const barHeight = (dataValue / 255) * maxBarHeight
    const x = i * barWidth

    // Draw the bar from bottom to top
    ctx.fillStyle = color
    ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight)
  }
}

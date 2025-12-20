// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  BOARD_WIDTH: 10,
  BOARD_HEIGHT: 20,
  DROP_TICK_INTERVAL: 20, // Frames between automatic drops
  CELL_COLOR: 'rgba(19, 181, 210, 0.9)', // Color for locked pieces
  CURRENT_PIECE_COLOR: 'rgba(255, 255, 255, 0.9)', // Color for current piece
  BORDER_COLOR: 'rgba(255, 255, 255, 0.5)', // Border color
  TEXT_COLOR: 'rgba(255, 255, 255, 0.9)', // Text color for score
  BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.1)', // Background for cells
} as const

// ============================================================================
// Types
// ============================================================================

type Piece = Array<[number, number]>

interface TetrisState {
  board: number[][]
  currentPiece: Piece | null
  currentX: number
  currentY: number
  tick: number
  score: number
  bag: Piece[]
  bagIndex: number
  gameOver: boolean
  paused: boolean
  canvasWidth: number
  canvasHeight: number
  cellSize: number
  boardOffsetX: number
  boardOffsetY: number
}

// ============================================================================
// Piece Definitions
// ============================================================================

const BAG_PIECES: Piece[] = [
  [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
  ], // T
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ], // O
  [
    [0, 0],
    [-1, 0],
    [1, 0],
    [2, 0],
  ], // I
  [
    [0, 0],
    [-1, 0],
    [0, 1],
    [1, 1],
  ], // S
  [
    [0, 1],
    [-1, 1],
    [0, 0],
    [1, 0],
  ], // Z
  [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [1, 0],
  ], // L
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [-1, 0],
  ], // J
]

// ============================================================================
// Persistent State per Canvas
// ============================================================================

const tetrisStateMap = new WeakMap<HTMLCanvasElement, TetrisState>()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a random bag of pieces (Fisher-Yates shuffle)
 */
function createRandomBag(): Piece[] {
  const bag = BAG_PIECES.map((piece) => piece.map(([x, y]) => [x, y] as [number, number]))
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

/**
 * Rotates a piece 90° clockwise around origin: (x,y) -> (y,-x)
 */
function rotatePiece(piece: Piece): Piece {
  return piece.map(([x, y]) => [y, -x] as [number, number])
}

/**
 * Checks if a piece at given position collides with board boundaries or locked pieces
 */
function checkCollision(x: number, y: number, shape: Piece, board: number[][]): boolean {
  for (const [sx, sy] of shape) {
    const nx = x + sx
    const ny = y + sy
    if (nx < 0 || nx >= CONFIG.BOARD_WIDTH || ny < 0 || ny >= CONFIG.BOARD_HEIGHT) {
      return true
    }
    if (board[ny] && board[ny][nx]) {
      return true
    }
  }
  return false
}

/**
 * Calculates cell size and board position to center the board on canvas
 */
function calculateLayout(
  canvasWidth: number,
  canvasHeight: number,
): {
  cellSize: number
  boardOffsetX: number
  boardOffsetY: number
} {
  // Calculate cell size to fit board with some padding
  // Reserve space for score text above board and status text below board
  // Using smaller scale factor (0.6) to make blocks smaller and board more compact
  const textAreaHeight = 60 // Space for score above and status below
  const availableHeight = canvasHeight - textAreaHeight
  const maxCellWidth = (canvasWidth * 0.6) / CONFIG.BOARD_WIDTH
  const maxCellHeight = (availableHeight * 0.6) / CONFIG.BOARD_HEIGHT
  const cellSize = Math.floor(Math.min(maxCellWidth, maxCellHeight))

  // Center the board horizontally and vertically
  const boardPixelWidth = CONFIG.BOARD_WIDTH * cellSize
  const boardPixelHeight = CONFIG.BOARD_HEIGHT * cellSize
  const boardOffsetX = (canvasWidth - boardPixelWidth) / 2
  const boardOffsetY = 30 + (availableHeight - boardPixelHeight) / 2 // 30px for score above

  return { cellSize, boardOffsetX, boardOffsetY }
}

/**
 * Initializes or resets the game state
 */
function initializeState(canvas: HTMLCanvasElement, width: number, height: number): TetrisState {
  canvas.width = width
  canvas.height = height

  const board = Array.from({ length: CONFIG.BOARD_HEIGHT }, () => Array(CONFIG.BOARD_WIDTH).fill(0))

  const bag = createRandomBag()
  const { cellSize, boardOffsetX, boardOffsetY } = calculateLayout(width, height)

  const state: TetrisState = {
    board,
    currentPiece: null,
    currentX: 4,
    currentY: 0,
    tick: 0,
    score: 0,
    bag,
    bagIndex: 0,
    gameOver: false,
    paused: false,
    canvasWidth: width,
    canvasHeight: height,
    cellSize,
    boardOffsetX,
    boardOffsetY,
  }

  spawnPiece(state)
  return state
}

/**
 * Spawns a new piece from the bag
 */
function spawnPiece(state: TetrisState): void {
  if (state.bagIndex >= state.bag.length) {
    state.bag = createRandomBag()
    state.bagIndex = 0
  }

  const piece = state.bag[state.bagIndex++]
  state.currentPiece = piece.map(([x, y]) => [x, y] as [number, number])
  state.currentX = 4
  state.currentY = 0

  if (checkCollision(state.currentX, state.currentY, state.currentPiece, state.board)) {
    state.gameOver = true
  }
}

/**
 * Locks the current piece to the board and clears completed lines
 */
function lockPiece(state: TetrisState): void {
  if (!state.currentPiece) return

  for (const [sx, sy] of state.currentPiece) {
    const x = state.currentX + sx
    const y = state.currentY + sy
    if (y >= 0 && y < CONFIG.BOARD_HEIGHT && x >= 0 && x < CONFIG.BOARD_WIDTH) {
      state.board[y][x] = 1
    }
  }

  clearLines(state)
  spawnPiece(state)
}

/**
 * Clears completed lines and updates score
 */
function clearLines(state: TetrisState): void {
  const newBoard: number[][] = []
  let linesCleared = 0

  for (const row of state.board) {
    if (row.some((cell) => cell === 0)) {
      newBoard.push(row)
    } else {
      linesCleared++
    }
  }

  // Add empty rows at the top
  while (newBoard.length < CONFIG.BOARD_HEIGHT) {
    newBoard.unshift(Array(CONFIG.BOARD_WIDTH).fill(0))
  }

  state.board = newBoard
  state.score += linesCleared * 100
}

/**
 * Moves the current piece horizontally
 */
function movePiece(state: TetrisState, dx: number): void {
  if (state.gameOver || state.paused || !state.currentPiece) return

  if (!checkCollision(state.currentX + dx, state.currentY, state.currentPiece, state.board)) {
    state.currentX += dx
  }
}

/**
 * Rotates the current piece with wall kick
 */
function rotatePieceInGame(state: TetrisState): void {
  if (state.gameOver || state.paused || !state.currentPiece) return

  const rotated = rotatePiece(state.currentPiece)
  if (!checkCollision(state.currentX, state.currentY, rotated, state.board)) {
    state.currentPiece = rotated
  } else {
    // Wall kick: try left
    if (!checkCollision(state.currentX - 1, state.currentY, rotated, state.board)) {
      state.currentX--
      state.currentPiece = rotated
    } else if (!checkCollision(state.currentX + 1, state.currentY, rotated, state.board)) {
      // Wall kick: try right
      state.currentX++
      state.currentPiece = rotated
    }
  }
}

/**
 * Soft drop: moves piece down one cell
 */
function softDrop(state: TetrisState): void {
  if (state.gameOver || state.paused || !state.currentPiece) return

  if (!checkCollision(state.currentX, state.currentY + 1, state.currentPiece, state.board)) {
    state.currentY++
  } else {
    lockPiece(state)
  }
}

/**
 * Hard drop: instantly drops piece to bottom
 */
function hardDrop(state: TetrisState): void {
  if (state.gameOver || state.paused || !state.currentPiece) return

  while (!checkCollision(state.currentX, state.currentY + 1, state.currentPiece, state.board)) {
    state.currentY++
  }
  lockPiece(state)
}

/**
 * Toggles pause state
 */
function togglePause(state: TetrisState): void {
  if (state.gameOver) return
  state.paused = !state.paused
}

/**
 * Draws a cell on the canvas
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  filled: boolean,
  isCurrentPiece: boolean,
  boardOffsetX: number,
  boardOffsetY: number,
): void {
  const pixelX = boardOffsetX + x * cellSize
  const pixelY = boardOffsetY + y * cellSize

  // Draw background
  ctx.fillStyle = CONFIG.BACKGROUND_COLOR
  ctx.fillRect(pixelX, pixelY, cellSize, cellSize)

  if (filled) {
    // Draw filled cell
    ctx.fillStyle = isCurrentPiece ? CONFIG.CURRENT_PIECE_COLOR : CONFIG.CELL_COLOR
    ctx.fillRect(pixelX + 1, pixelY + 1, cellSize - 2, cellSize - 2)

    // Draw border
    ctx.strokeStyle = CONFIG.BORDER_COLOR
    ctx.lineWidth = 1
    ctx.strokeRect(pixelX + 1, pixelY + 1, cellSize - 2, cellSize - 2)
  }
}

/**
 * Renders the game board and score
 */
function render(
  ctx: CanvasRenderingContext2D,
  state: TetrisState,
  boardOffsetX: number,
  boardOffsetY: number,
): void {
  // Clear canvas
  ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight)

  // Draw score - positioned just above the board frame
  ctx.fillStyle = CONFIG.TEXT_COLOR
  ctx.font = `${Math.max(16, state.cellSize * 0.8)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const scoreText = `Score: ${state.score}`
  ctx.fillText(scoreText, state.canvasWidth / 2, boardOffsetY - 5)

  if (state.gameOver) {
    ctx.fillStyle = CONFIG.TEXT_COLOR
    ctx.font = `${Math.max(14, state.cellSize * 0.6)}px monospace`
    ctx.textBaseline = 'top'
    ctx.fillText(
      'GAME OVER',
      state.canvasWidth / 2,
      boardOffsetY + CONFIG.BOARD_HEIGHT * state.cellSize + 5,
    )
    return
  }

  if (state.paused) {
    ctx.fillStyle = CONFIG.TEXT_COLOR
    ctx.font = `${Math.max(14, state.cellSize * 0.6)}px monospace`
    ctx.textBaseline = 'top'
    ctx.fillText(
      'PAUSED',
      state.canvasWidth / 2,
      boardOffsetY + CONFIG.BOARD_HEIGHT * state.cellSize + 5,
    )
  }

  // Create a copy of the board for rendering
  const renderBoard = state.board.map((row) => row.slice())

  // Mark current piece on the board
  if (state.currentPiece) {
    for (const [sx, sy] of state.currentPiece) {
      const x = state.currentX + sx
      const y = state.currentY + sy
      if (y >= 0 && y < CONFIG.BOARD_HEIGHT && x >= 0 && x < CONFIG.BOARD_WIDTH) {
        renderBoard[y][x] = 2 // Mark as current piece
      }
    }
  }

  // Draw board
  for (let y = 0; y < CONFIG.BOARD_HEIGHT; y++) {
    for (let x = 0; x < CONFIG.BOARD_WIDTH; x++) {
      const cellValue = renderBoard[y][x]
      const filled = cellValue !== 0
      const isCurrentPiece = cellValue === 2
      drawCell(ctx, x, y, state.cellSize, filled, isCurrentPiece, boardOffsetX, boardOffsetY)
    }
  }

  // Draw board border
  ctx.strokeStyle = CONFIG.BORDER_COLOR
  ctx.lineWidth = 2
  ctx.strokeRect(
    boardOffsetX,
    boardOffsetY,
    CONFIG.BOARD_WIDTH * state.cellSize,
    CONFIG.BOARD_HEIGHT * state.cellSize,
  )
}

// ============================================================================
// Keyboard Input Handler
// ============================================================================

// Global keyboard handler state
const keyboardHandlers = new WeakMap<HTMLCanvasElement, (e: KeyboardEvent) => void>()

/**
 * Sets up keyboard event listeners for a canvas
 */
export function setupTetrisKeyboard(canvas: HTMLCanvasElement, state: TetrisState): void {
  // Remove existing handler if any
  const existingHandler = keyboardHandlers.get(canvas)
  if (existingHandler) {
    document.removeEventListener('keydown', existingHandler)
  }

  const handler = (e: KeyboardEvent) => {
    // Only handle keys if canvas is visible and focused (or document focused)
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      movePiece(state, -1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      movePiece(state, 1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      softDrop(state)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      rotatePieceInGame(state)
    } else if (e.code === 'Space') {
      e.preventDefault()
      hardDrop(state)
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault()
      togglePause(state)
    }
  }

  keyboardHandlers.set(canvas, handler)
  document.addEventListener('keydown', handler)
}

/**
 * Cleans up keyboard event listeners for a canvas
 */
export function cleanupTetrisKeyboard(canvas: HTMLCanvasElement): void {
  const handler = keyboardHandlers.get(canvas)
  if (handler) {
    document.removeEventListener('keydown', handler)
    keyboardHandlers.delete(canvas)
  }
}

// ============================================================================
// Main Visualizer Function
// ============================================================================

/**
 * Tetris visualizer
 * Interactive Tetris game rendered on canvas
 * Works independently of audio data
 *
 * @param ctx - Canvas 2D rendering context
 * @param dataArray - Audio data array (not used, but required for compatibility)
 * @param canvas - HTML canvas element
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 */
export const tetrisVisualizer = (
  ctx: CanvasRenderingContext2D,
  _dataArray: Uint8Array, // Not used - Tetris works independently of audio
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  // Get or initialize game state
  let state = tetrisStateMap.get(canvas)

  // If canvas changed size or state doesn't exist, reinitialize
  if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
    state = initializeState(canvas, width, height)
    tetrisStateMap.set(canvas, state)

    // Setup keyboard controls
    setupTetrisKeyboard(canvas, state)
  }

  // Recalculate layout if needed (for responsive)
  const { cellSize, boardOffsetX, boardOffsetY } = calculateLayout(width, height)
  state.cellSize = cellSize
  state.boardOffsetX = boardOffsetX
  state.boardOffsetY = boardOffsetY

  // Update game logic (only if not paused and not game over)
  if (!state.gameOver && !state.paused) {
    state.tick++
    if (state.tick % CONFIG.DROP_TICK_INTERVAL === 0) {
      if (
        state.currentPiece &&
        !checkCollision(state.currentX, state.currentY + 1, state.currentPiece, state.board)
      ) {
        state.currentY++
      } else {
        lockPiece(state)
      }
    }
  }

  // Render the game
  render(ctx, state, boardOffsetX, boardOffsetY)
}

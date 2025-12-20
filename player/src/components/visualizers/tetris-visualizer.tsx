// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  BOARD_HEIGHT: 20,
  DROP_TICK_INTERVAL: 20, // Frames between automatic drops
  CELL_COLOR: 'rgba(19, 181, 210, 0.4)', // Color for locked pieces
  CURRENT_PIECE_COLOR: 'rgba(255, 255, 255, 0.4)', // Color for current piece
  BORDER_COLOR: 'rgba(255, 255, 255, 0)', // Border color
  BACKGROUND_COLOR: 'rgba(0, 0, 0, 0)', // Background for cells
} as const

// ============================================================================
// Types
// ============================================================================

type Piece = Array<[number, number]>

interface TetrisState {
  board: number[][]
  currentPiece: Piece | null
  originalPiece: Piece | null
  currentX: number
  currentY: number
  tick: number
  score: number
  bag: Piece[]
  bagIndex: number
  canvasWidth: number
  canvasHeight: number
  boardWidth: number
  cellSize: number
  boardOffsetX: number
  boardOffsetY: number
  aiTargetRotation: number
  aiTargetX: number
  aiCurrentRotation: number
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
function checkCollision(
  x: number,
  y: number,
  shape: Piece,
  board: number[][],
  boardWidth: number,
): boolean {
  for (const [sx, sy] of shape) {
    const nx = x + sx
    const ny = y + sy
    if (nx < 0 || nx >= boardWidth || ny < 0 || ny >= CONFIG.BOARD_HEIGHT) {
      return true
    }
    if (board[ny] && board[ny][nx]) {
      return true
    }
  }
  return false
}

/**
 * Calculates cell size, board width, and board position to center the board on canvas
 * Board width is calculated based on viewport width, maintaining the current cell size
 */
function calculateLayout(
  canvasWidth: number,
  canvasHeight: number,
): {
  cellSize: number
  boardWidth: number
  boardOffsetX: number
  boardOffsetY: number
} {
  // Calculate cell size to fill 100% of both width and height
  // Calculate based on height to ensure it fits vertically
  const cellSizeByHeight = Math.floor(canvasHeight / CONFIG.BOARD_HEIGHT)

  // Calculate board width based on height-based cell size to fill 100% of width
  const boardWidth = Math.max(8, Math.floor(canvasWidth / cellSizeByHeight))

  // Adjust cell size to exactly fill the width (100% horizontal)
  const cellSize = Math.floor(canvasWidth / boardWidth)

  // Start from top-left corner (0, 0) to occupy 100% of viewport
  const boardOffsetX = 0
  const boardOffsetY = 0

  return { cellSize, boardWidth, boardOffsetX, boardOffsetY }
}

/**
 * Initializes or resets the game state
 */
function initializeState(canvas: HTMLCanvasElement, width: number, height: number): TetrisState {
  canvas.width = width
  canvas.height = height

  const bag = createRandomBag()
  const { cellSize, boardWidth, boardOffsetX, boardOffsetY } = calculateLayout(width, height)

  const board = Array.from({ length: CONFIG.BOARD_HEIGHT }, () => Array(boardWidth).fill(0))

  const state: TetrisState = {
    board,
    currentPiece: null,
    originalPiece: null,
    currentX: Math.floor(boardWidth / 2),
    currentY: 0,
    tick: 0,
    score: 0,
    bag,
    bagIndex: 0,
    canvasWidth: width,
    canvasHeight: height,
    boardWidth,
    cellSize,
    boardOffsetX,
    boardOffsetY,
    aiTargetRotation: 0,
    aiTargetX: Math.floor(boardWidth / 2),
    aiCurrentRotation: 0,
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
  const originalPiece = piece.map(([x, y]) => [x, y] as [number, number])
  state.originalPiece = originalPiece
  state.currentPiece = originalPiece.map(([x, y]) => [x, y] as [number, number])
  state.currentX = Math.floor(state.boardWidth / 2)
  state.currentY = 0
  state.aiCurrentRotation = 0

  // If can't spawn, clear board and reset score (infinite mode)
  if (
    checkCollision(
      state.currentX,
      state.currentY,
      state.currentPiece,
      state.board,
      state.boardWidth,
    )
  ) {
    // Clear the board completely
    state.board = Array.from({ length: CONFIG.BOARD_HEIGHT }, () => Array(state.boardWidth).fill(0))
    state.score = 0
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
    if (y >= 0 && y < CONFIG.BOARD_HEIGHT && x >= 0 && x < state.boardWidth) {
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
    newBoard.unshift(Array(state.boardWidth).fill(0))
  }

  state.board = newBoard
  state.score += linesCleared * 100
}

/**
 * Moves the current piece horizontally
 */
function movePiece(state: TetrisState, dx: number): void {
  if (!state.currentPiece) return

  if (
    !checkCollision(
      state.currentX + dx,
      state.currentY,
      state.currentPiece,
      state.board,
      state.boardWidth,
    )
  ) {
    state.currentX += dx
  }
}

/**
 * Rotates the current piece with wall kick
 */
function rotatePieceInGame(state: TetrisState): void {
  if (!state.currentPiece) return

  const rotated = rotatePiece(state.currentPiece)
  if (!checkCollision(state.currentX, state.currentY, rotated, state.board, state.boardWidth)) {
    state.currentPiece = rotated
    state.aiCurrentRotation = (state.aiCurrentRotation + 1) % 4
  } else {
    // Wall kick: try left
    if (
      !checkCollision(state.currentX - 1, state.currentY, rotated, state.board, state.boardWidth)
    ) {
      state.currentX--
      state.currentPiece = rotated
      state.aiCurrentRotation = (state.aiCurrentRotation + 1) % 4
    } else if (
      !checkCollision(state.currentX + 1, state.currentY, rotated, state.board, state.boardWidth)
    ) {
      // Wall kick: try right
      state.currentX++
      state.currentPiece = rotated
      state.aiCurrentRotation = (state.aiCurrentRotation + 1) % 4
    }
  }
}

/**
 * Soft drop: moves piece down one cell
 */
function softDrop(state: TetrisState): void {
  if (!state.currentPiece) return

  if (
    !checkCollision(
      state.currentX,
      state.currentY + 1,
      state.currentPiece,
      state.board,
      state.boardWidth,
    )
  ) {
    state.currentY++
  } else {
    lockPiece(state)
  }
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
 * Renders the game board
 */
function render(
  ctx: CanvasRenderingContext2D,
  state: TetrisState,
  boardOffsetX: number,
  boardOffsetY: number,
): void {
  // Clear canvas
  ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight)

  // Create a copy of the board for rendering
  const renderBoard = state.board.map((row) => row.slice())

  // Mark current piece on the board
  if (state.currentPiece) {
    for (const [sx, sy] of state.currentPiece) {
      const x = state.currentX + sx
      const y = state.currentY + sy
      if (y >= 0 && y < CONFIG.BOARD_HEIGHT && x >= 0 && x < state.boardWidth) {
        renderBoard[y][x] = 2 // Mark as current piece
      }
    }
  }

  // Draw board
  for (let y = 0; y < CONFIG.BOARD_HEIGHT; y++) {
    for (let x = 0; x < state.boardWidth; x++) {
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
    state.boardWidth * state.cellSize,
    CONFIG.BOARD_HEIGHT * state.cellSize,
  )
}

// ============================================================================
// AI Functions
// ============================================================================

/**
 * Simulates placing a piece at a given position and calculates a score
 * Lower score is better (minimize height, maximize lines, minimize holes)
 */
function evaluatePosition(
  x: number,
  y: number,
  piece: Piece,
  board: number[][],
  boardWidth: number,
): { score: number; linesCleared: number; maxHeight: number; holes: number; avgHeight: number } {
  // Create a temporary board to simulate placement
  const tempBoard = board.map((row) => row.slice())

  // Place the piece
  for (const [sx, sy] of piece) {
    const px = x + sx
    const py = y + sy
    if (py >= 0 && py < CONFIG.BOARD_HEIGHT && px >= 0 && px < boardWidth) {
      tempBoard[py][px] = 1
    }
  }

  // Clear completed lines first
  const boardAfterClear: number[][] = []
  let linesCleared = 0

  for (let row = 0; row < CONFIG.BOARD_HEIGHT; row++) {
    const isFullLine = tempBoard[row].every((cell) => cell === 1)
    if (!isFullLine) {
      boardAfterClear.push(tempBoard[row])
    } else {
      linesCleared++
    }
  }

  // Add empty rows at the top
  while (boardAfterClear.length < CONFIG.BOARD_HEIGHT) {
    boardAfterClear.unshift(Array(boardWidth).fill(0))
  }

  // Calculate metrics on the cleared board
  let maxHeight = 0
  let totalHeight = 0
  let holes = 0
  const columnHeights: number[] = Array(boardWidth).fill(0)

  // Find column heights
  for (let col = 0; col < boardWidth; col++) {
    for (let row = 0; row < CONFIG.BOARD_HEIGHT; row++) {
      if (boardAfterClear[row][col] === 1) {
        const height = CONFIG.BOARD_HEIGHT - row
        columnHeights[col] = height
        maxHeight = Math.max(maxHeight, height)
        totalHeight += height
        break
      }
    }
  }

  // Count holes (empty cells with filled cells above)
  for (let col = 0; col < boardWidth; col++) {
    let foundBlock = false
    for (let row = 0; row < CONFIG.BOARD_HEIGHT; row++) {
      if (boardAfterClear[row][col] === 1) {
        foundBlock = true
      } else if (foundBlock && boardAfterClear[row][col] === 0) {
        // This is a hole
        holes++
      }
    }
  }

  // Calculate average height
  const avgHeight = totalHeight / boardWidth

  // Calculate score: lower is better
  // Weights optimized for survival:
  // - Max height: heavily penalized (x200) - critical for survival
  // - Average height: penalized (x50) - keep board low
  // - Holes: heavily penalized (x100) - create problems
  // - Lines cleared: heavily rewarded (-500) - essential for survival
  // - Bumpiness: penalized (x30) - uneven surface is bad
  let bumpiness = 0
  for (let i = 0; i < boardWidth - 1; i++) {
    bumpiness += Math.abs(columnHeights[i] - columnHeights[i + 1])
  }

  const score = maxHeight * 200 + avgHeight * 50 + holes * 100 + bumpiness * 30 - linesCleared * 500

  return { score, linesCleared, maxHeight, holes, avgHeight }
}

/**
 * Evaluates the best position for the current piece
 * Returns the best rotation and x position
 */
function evaluateBestPosition(state: TetrisState): { rotation: number; x: number; score: number } {
  if (!state.currentPiece || !state.originalPiece) {
    return { rotation: 0, x: 4, score: Infinity }
  }

  let bestScore = Infinity
  let bestRotation = 0
  let bestX = 4
  let foundValidPosition = false

  // Try all 4 rotations starting from the original piece
  let piece = state.originalPiece.map(([x, y]) => [x, y] as [number, number])
  for (let rotation = 0; rotation < 4; rotation++) {
    // Try all horizontal positions (with some margin for pieces that extend beyond)
    for (let x = -3; x < state.boardWidth + 3; x++) {
      // Find the lowest valid Y position
      let y = 0
      while (
        !checkCollision(x, y + 1, piece, state.board, state.boardWidth) &&
        y < CONFIG.BOARD_HEIGHT
      ) {
        y++
      }

      // If position is valid, evaluate it
      if (!checkCollision(x, y, piece, state.board, state.boardWidth)) {
        foundValidPosition = true
        const evaluation = evaluatePosition(x, y, piece, state.board, state.boardWidth)

        // Prioritize positions that clear lines if board is getting high
        const currentMaxHeight = getCurrentMaxHeight(state.board, state.boardWidth)
        let adjustedScore = evaluation.score

        // If board is high (above 15), heavily prioritize clearing lines
        if (currentMaxHeight > 15 && evaluation.linesCleared > 0) {
          adjustedScore -= 1000 // Big bonus for clearing lines when high
        }

        // If board is very high (above 18), prioritize any line clearing
        if (currentMaxHeight > 18) {
          adjustedScore = evaluation.linesCleared > 0 ? -Infinity : Infinity
        }

        if (adjustedScore < bestScore) {
          bestScore = adjustedScore
          bestRotation = rotation
          bestX = x
        }
      }
    }

    // Rotate for next iteration
    piece = rotatePiece(piece)
  }

  // If no valid position found, try center as fallback
  if (!foundValidPosition) {
    bestX = Math.floor(state.boardWidth / 2)
    bestRotation = 0
  }

  return { rotation: bestRotation, x: bestX, score: bestScore }
}

/**
 * Gets the current maximum height of the board
 */
function getCurrentMaxHeight(board: number[][], boardWidth: number): number {
  let maxHeight = 0
  for (let col = 0; col < boardWidth; col++) {
    for (let row = 0; row < CONFIG.BOARD_HEIGHT; row++) {
      if (board[row][col] === 1) {
        const height = CONFIG.BOARD_HEIGHT - row
        maxHeight = Math.max(maxHeight, height)
        break
      }
    }
  }
  return maxHeight
}

/**
 * Calculates the current rotation of the piece by comparing it with the original
 */
function getCurrentRotation(originalPiece: Piece, currentPiece: Piece): number {
  let piece = originalPiece.map(([x, y]) => [x, y] as [number, number])

  for (let rotation = 0; rotation < 4; rotation++) {
    // Compare pieces (check if all coordinates match)
    if (piece.length === currentPiece.length) {
      const pieceSorted = [...piece].sort(([x1, y1], [x2, y2]) => x1 - x2 || y1 - y2)
      const currentSorted = [...currentPiece].sort(([x1, y1], [x2, y2]) => x1 - x2 || y1 - y2)
      let matches = true
      for (let i = 0; i < pieceSorted.length; i++) {
        if (
          pieceSorted[i][0] !== currentSorted[i][0] ||
          pieceSorted[i][1] !== currentSorted[i][1]
        ) {
          matches = false
          break
        }
      }
      if (matches) {
        return rotation
      }
    }
    piece = rotatePiece(piece)
  }
  return 0
}

/**
 * Executes AI moves to reach the target position
 */
function executeAIMove(state: TetrisState): void {
  if (!state.currentPiece || !state.originalPiece) return

  // Calculate current rotation
  const currentRotation = getCurrentRotation(state.originalPiece, state.currentPiece)
  state.aiCurrentRotation = currentRotation

  // Recalculate best position more frequently for better responsiveness
  // Recalculate when piece spawns, every 5 ticks, or if board is getting high
  const currentMaxHeight = getCurrentMaxHeight(state.board, state.boardWidth)
  const shouldRecalculate = currentRotation === 0 || state.tick % 5 === 0 || currentMaxHeight > 15

  if (shouldRecalculate) {
    const best = evaluateBestPosition(state)
    state.aiTargetRotation = best.rotation
    state.aiTargetX = best.x
  }

  // Rotate if needed (prioritize rotation first)
  if (currentRotation !== state.aiTargetRotation) {
    rotatePieceInGame(state)
    return // Wait for next tick to move horizontally
  }

  // Move horizontally if needed
  if (state.currentX < state.aiTargetX) {
    movePiece(state, 1)
    return
  } else if (state.currentX > state.aiTargetX) {
    movePiece(state, -1)
    return
  }

  // If in position, do soft drop (or hard drop if board is high)
  if (state.currentX === state.aiTargetX && currentRotation === state.aiTargetRotation) {
    // If board is getting high, drop faster
    if (currentMaxHeight > 16) {
      // Hard drop when high to clear lines faster
      while (
        state.currentPiece &&
        !checkCollision(
          state.currentX,
          state.currentY + 1,
          state.currentPiece,
          state.board,
          state.boardWidth,
        )
      ) {
        state.currentY++
      }
      lockPiece(state)
    } else {
      softDrop(state)
    }
  }
}

// ============================================================================
// Main Visualizer Function
// ============================================================================

/**
 * Tetris visualizer
 * Automatic infinite Tetris game rendered on canvas
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
  }

  // Recalculate layout if needed (for responsive)
  const { cellSize, boardWidth, boardOffsetX, boardOffsetY } = calculateLayout(width, height)

  // If board width changed, need to reinitialize
  if (state.boardWidth !== boardWidth) {
    state = initializeState(canvas, width, height)
    tetrisStateMap.set(canvas, state)
  } else {
    state.cellSize = cellSize
    state.boardOffsetX = boardOffsetX
    state.boardOffsetY = boardOffsetY
  }

  // Update game logic
  state.tick++

  // Execute AI moves every 3 ticks for smooth movement
  if (state.tick % 3 === 0) {
    executeAIMove(state)
  }

  // Automatic drop every DROP_TICK_INTERVAL ticks
  if (state.tick % CONFIG.DROP_TICK_INTERVAL === 0) {
    if (
      state.currentPiece &&
      !checkCollision(
        state.currentX,
        state.currentY + 1,
        state.currentPiece,
        state.board,
        state.boardWidth,
      )
    ) {
      state.currentY++
    } else {
      lockPiece(state)
    }
  }

  // Render the game
  render(ctx, state, boardOffsetX, boardOffsetY)
}

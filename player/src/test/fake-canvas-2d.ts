// FakeCanvas2D: happy-dom has no 2D canvas context. The fake records every method
// call and every property assignment as a line of text, with numbers rounded to two
// decimals, so a characterization test can compare what a visualizer draws with a
// snapshot. FakeCanvasElement counts the size assignments.

function format(value: unknown): string {
  if (typeof value === 'number') {
    const rounded = Math.round(value * 100) / 100
    return Object.is(rounded, -0) ? '0' : String(rounded)
  }
  return String(value)
}

export interface FakeCanvas2D {
  /** One line per call (`fillRect(0, 1.5, 2, 3)`) or assignment (`fillStyle = red`) */
  readonly log: string[]
}

/**
 * Creates a 2D context double that records any method call or property assignment.
 * Reading a property returns the last value assigned to it; anything never assigned
 * reads as a recording method.
 */
export function createFakeCanvas2D(): CanvasRenderingContext2D & FakeCanvas2D {
  const log: string[] = []
  const values = new Map<PropertyKey, unknown>()
  const target = {} as CanvasRenderingContext2D & FakeCanvas2D

  return new Proxy(target, {
    get(_target, prop) {
      if (prop === 'log') return log
      if (values.has(prop)) return values.get(prop)
      return (...args: unknown[]) => {
        log.push(`${String(prop)}(${args.map(format).join(', ')})`)
      }
    },
    set(_target, prop, value: unknown) {
      values.set(prop, value)
      log.push(`${String(prop)} = ${format(value)}`)
      return true
    },
  })
}

/** Canvas element double: keeps width and height and counts how often they are set */
export class FakeCanvasElement {
  sizeAssignments = 0
  private currentWidth = 300
  private currentHeight = 150

  get width() {
    return this.currentWidth
  }
  set width(value: number) {
    this.sizeAssignments++
    this.currentWidth = value
  }
  get height() {
    return this.currentHeight
  }
  set height(value: number) {
    this.sizeAssignments++
    this.currentHeight = value
  }

  asCanvas(): HTMLCanvasElement {
    return this as unknown as HTMLCanvasElement
  }
}

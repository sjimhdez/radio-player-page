/**
 * Tells whether the user agent is WebKit: AppleWebKit without a Chrome or Chromium
 * token. That is Safari and every iOS browser (CriOS, FxiOS and EdgiOS carry neither);
 * Edge and Opera carry Chrome.
 *
 * Measured exception: WebKit only feeds the analyser with a finite MP3 that has a
 * length, which a radio stream is not, so it never visualizes (ADR 0033).
 */
export function isWebKitBrowser(userAgent: string): boolean {
  return /AppleWebKit/.test(userAgent) && !/Chrome|Chromium/.test(userAgent)
}

/** What the visualizer graph needs from the browser */
export interface VisualizerGraphOptions {
  /** Creates the AudioContext; undefined when the browser has no Web Audio API */
  createContext?: () => AudioContext
  /** navigator.userAgent, for the WebKit exception */
  userAgent: string
}

/** The Web Audio graph behind the visualizer: element source → analyser → destination */
export interface VisualizerGraph {
  /** There is a context constructor and the browser is not WebKit */
  readonly supported: boolean
  /**
   * Creates the context, or resumes it if suspended. Synchronous, to run inside the
   * Play gesture: WebKit keeps a context created or resumed outside it silent.
   */
  prepare: () => void
  /** Routes the element through the analyser; only the first call does anything */
  connect: (audio: HTMLMediaElement) => void
  /** The element goes through the graph: its output is the graph's */
  isConnected: () => boolean
  getAnalyser: () => AnalyserNode | null
}

/**
 * Creates the visualizer graph. Nothing is created until prepare(), and nothing at all
 * when the graph is not supported.
 */
export function createVisualizerGraph({
  createContext,
  userAgent,
}: VisualizerGraphOptions): VisualizerGraph {
  const factory = isWebKitBrowser(userAgent) ? undefined : createContext
  let context: AudioContext | null = null
  let analyser: AnalyserNode | null = null

  return {
    supported: factory !== undefined,

    prepare() {
      if (!factory) return
      if (!context) {
        try {
          context = factory()
        } catch {
          // No context, no visualizer: playback goes on.
        }
        return
      }
      if (context.state === 'suspended') context.resume().catch(() => {})
    },

    connect(audio) {
      if (!context || analyser) return
      try {
        const source = context.createMediaElementSource(audio)
        const node = context.createAnalyser()
        node.fftSize = 256
        source.connect(node)
        node.connect(context.destination)
        analyser = node
      } catch {
        // The element stays out of the graph and keeps its own output.
      }
    },

    isConnected() {
      return analyser !== null
    },

    getAnalyser() {
      return analyser
    },
  }
}

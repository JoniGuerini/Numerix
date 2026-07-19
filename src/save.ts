import { D, ZERO } from './decimal'
import {
  GENERATOR_COUNT,
  advanceTime,
  createInitialState,
  type GameState,
} from './game'

const SAVE_KEY = 'numerix-save'
const SAVE_VERSION = 3

type SaveData = {
  version: number
  savedAt: number
  base: string
  gens: string[]
  bought: string[]
}

export function saveGame(state: GameState): void {
  const data: SaveData = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    base: state.base.toString(),
    gens: state.gens.map((g) => g.toString()),
    bought: state.bought.map((b) => b.toString()),
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
}

function parseAmount(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return String(value)
  }
  return null
}

function isValidSave(
  data: unknown,
): data is {
  version: number
  savedAt: number
  base: unknown
  gens: unknown[]
  bought?: unknown[]
} {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const versionOk = d.version === 1 || d.version === 2 || d.version === SAVE_VERSION
  return (
    versionOk &&
    typeof d.savedAt === 'number' &&
    Array.isArray(d.gens) &&
    d.gens.length > 0 &&
    d.gens.length <= GENERATOR_COUNT &&
    parseAmount(d.base) !== null &&
    d.gens.every((g) => parseAmount(g) !== null) &&
    (d.bought === undefined ||
      (Array.isArray(d.bought) &&
        d.bought.length <= GENERATOR_COUNT &&
        d.bought.every((b) => parseAmount(b) !== null)))
  )
}

function normalizeAmounts(values: unknown[] | undefined): GameState['gens'] {
  const next = (values ?? []).slice(0, GENERATOR_COUNT).map((g) => D(parseAmount(g)!))
  while (next.length < GENERATOR_COUNT) next.push(ZERO)
  return next
}

/** Carrega o save e aplica progresso offline desde o último savedAt. */
export function loadGame(): GameState {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return createInitialState()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isValidSave(parsed)) return createInitialState()

    const gens = normalizeAmounts(parsed.gens)
    // Saves antigos sem `bought`: preço só sobe em compras novas (começa zerado)
    const bought = parsed.bought
      ? normalizeAmounts(parsed.bought)
      : Array.from({ length: GENERATOR_COUNT }, () => ZERO)

    let state: GameState = {
      base: D(parseAmount(parsed.base)!),
      gens,
      bought,
    }

    const elapsed = Math.max(0, (Date.now() - parsed.savedAt) / 1000)
    return advanceTime(state, elapsed)
  } catch {
    return createInitialState()
  }
}

export function resetSave(): GameState {
  localStorage.removeItem(SAVE_KEY)
  return createInitialState()
}

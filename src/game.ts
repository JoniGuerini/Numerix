import { D, ZERO, formatNumber, type Decimal } from './decimal'

export { formatNumber }
export type { Decimal }

export const GENERATOR_COUNT = 20

export type GeneratorDef = {
  /** 1..20 */
  id: number
  /** Produção/s do recurso anterior (base para id=1) */
  rate: Decimal
  /** Custo base em recurso base */
  baseCost: Decimal
  /** Multiplicador de preço a cada compra */
  costMult: Decimal
}

/**
 * Cada gerador produz o anterior.
 * G1 → base, G2 → G1, …, G20 → G19.
 * Preços e multiplicadores diferentes por tier.
 * break_eternity (Decimal) é a fonte da verdade numérica.
 */
export const GENERATORS: GeneratorDef[] = [
  { id: 1, rate: D(0.1), baseCost: D(10), costMult: D(1.12) },
  { id: 2, rate: D(0.1), baseCost: D(100), costMult: D(1.14) },
  { id: 3, rate: D(0.1), baseCost: D(1_200), costMult: D(1.15) },
  { id: 4, rate: D(0.1), baseCost: D(15_000), costMult: D(1.16) },
  { id: 5, rate: D(0.1), baseCost: D(200_000), costMult: D(1.17) },
  { id: 6, rate: D(0.1), baseCost: D(2_800_000), costMult: D(1.18) },
  { id: 7, rate: D(0.1), baseCost: D(40_000_000), costMult: D(1.19) },
  { id: 8, rate: D(0.1), baseCost: D(600_000_000), costMult: D(1.2) },
  { id: 9, rate: D(0.1), baseCost: D(10_000_000_000), costMult: D(1.22) },
  { id: 10, rate: D(0.1), baseCost: D(180_000_000_000), costMult: D(1.25) },
  { id: 11, rate: D(0.1), baseCost: D('3.5e12'), costMult: D(1.26) },
  { id: 12, rate: D(0.1), baseCost: D('7e13'), costMult: D(1.27) },
  { id: 13, rate: D(0.1), baseCost: D('1.5e15'), costMult: D(1.28) },
  { id: 14, rate: D(0.1), baseCost: D('3.5e16'), costMult: D(1.29) },
  { id: 15, rate: D(0.1), baseCost: D('8e17'), costMult: D(1.3) },
  { id: 16, rate: D(0.1), baseCost: D('2e19'), costMult: D(1.31) },
  { id: 17, rate: D(0.1), baseCost: D('5e20'), costMult: D(1.32) },
  { id: 18, rate: D(0.1), baseCost: D('1.4e22'), costMult: D(1.33) },
  { id: 19, rate: D(0.1), baseCost: D('4e23'), costMult: D(1.34) },
  { id: 20, rate: D(0.1), baseCost: D('1.2e25'), costMult: D(1.35) },
]

export type GameState = {
  base: Decimal
  /** Quantidade total de cada gerador (comprada + produzida) */
  gens: Decimal[]
  /** Quantidade comprada — só isso define o preço */
  bought: Decimal[]
}

export function createInitialState(): GameState {
  return {
    // Suficiente para a primeira compra do Gerador 1
    base: D(GENERATORS[0].baseCost),
    gens: Array.from({ length: GENERATOR_COUNT }, () => ZERO),
    bought: Array.from({ length: GENERATOR_COUNT }, () => ZERO),
  }
}

export function getCost(tierIndex: number, bought: Decimal): Decimal {
  const def = GENERATORS[tierIndex]
  return def.baseCost.times(def.costMult.pow(bought))
}

/**
 * Avança o estado pelo delta em segundos.
 * Produção simultânea (Euler): cada gerador usa a quantidade do início do tick.
 */
export function tick(state: GameState, dt: number): GameState {
  if (dt <= 0) return state

  const dtD = D(dt)
  const nextGens = state.gens.map((g) => D(g))

  for (let i = 0; i < GENERATOR_COUNT - 1; i++) {
    nextGens[i] = nextGens[i].plus(
      state.gens[i + 1].times(GENERATORS[i + 1].rate).times(dtD),
    )
  }

  const base = state.base.plus(state.gens[0].times(GENERATORS[0].rate).times(dtD))

  return { base, gens: nextGens, bought: state.bought }
}

export function buyGenerator(state: GameState, tierIndex: number): GameState {
  const cost = getCost(tierIndex, state.bought[tierIndex])
  if (state.base.lt(cost)) return state

  const gens = state.gens.map((g) => D(g))
  const bought = state.bought.map((b) => D(b))
  gens[tierIndex] = gens[tierIndex].plus(1)
  bought[tierIndex] = bought[tierIndex].plus(1)

  return {
    base: state.base.minus(cost).clampMin(0),
    gens,
    bought,
  }
}

/**
 * Crescimento/s da quantidade desta linha (o que entra nela).
 * Base ← G1 · G1 ← G2 · G2 ← G3 · …
 */
export function productionOf(state: GameState, tierIndex: number): Decimal {
  if (tierIndex < 0) {
    return state.gens[0].times(GENERATORS[0].rate)
  }
  if (tierIndex >= GENERATOR_COUNT - 1) return ZERO
  return state.gens[tierIndex + 1].times(GENERATORS[tierIndex + 1].rate)
}

export function targetLabel(tierIndex: number): string {
  return tierIndex === 0 ? 'base' : `G${tierIndex}`
}

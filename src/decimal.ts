import Decimal from 'break_eternity.js'
import type { DecimalSource } from 'break_eternity.js'

export { Decimal }
export type { DecimalSource }

export const D = (value: DecimalSource = 0): Decimal => new Decimal(value)

export const ZERO = D(0)
export const ONE = D(1)

/** Casas decimais padrão na UI */
export const DISPLAY_PLACES = 2

/**
 * Epsilon relativo ao último dígito exibido.
 * Corrige artefatos tipo 399.999… → "399" quando o valor efetivo é 400.
 * Só afeta a cópia usada na formatação — nunca o estado do jogo.
 */
const DISPLAY_EPS = 1e-9

/**
 * Sufixos nomeados por grupo de 1000 (short scale).
 * índice 1 = 1e3 (K) … índice 10 = 1e30 (No / nonilhão)
 */
const NAMED_SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
] as const

/** Último grupo nomeado (No = 1e30). Depois começa aa em 1e33. */
const LAST_NAMED_GROUP = NAMED_SUFFIXES.length - 1

/** Limite de letras no sufixo antes de cair no científico. */
const MAX_LETTER_LEN = 64

/**
 * Prepara um Decimal só para exibição: trunca casas e corrige
 * valores absurdamente perto do próximo limiar de truncagem.
 */
export function forDisplay(value: DecimalSource, places = DISPLAY_PLACES): Decimal {
  const n = D(value)
  if (!n.isFinite() || n.eq(0)) return ZERO

  const sign = n.sign
  const abs = n.abs()
  const factor = Decimal.pow(10, places)
  const scaled = abs.times(factor)
  const truncated = scaled.trunc()
  const frac = scaled.minus(truncated)

  const bumped = frac.gte(1 - DISPLAY_EPS) ? truncated.plus(1) : truncated
  const result = bumped.div(factor)
  return sign < 0 ? result.neg() : result
}

/**
 * Formata truncando (nunca arredondando).
 * K…No até nonilhão (1e30); depois letras aa→zz, aaa→… .
 * Carry se mantissa truncada chegar a 1000.
 */
export function formatNumber(value: DecimalSource, places = DISPLAY_PLACES): string {
  const n = D(value)
  if (!n.isFinite()) return truncatePlain(ZERO, places)
  if (n.eq(0)) return truncatePlain(ZERO, places)

  const sign = n.sign < 0 ? '-' : ''
  let abs = forDisplay(n.abs(), places)

  if (abs.lt(1000)) {
    return sign + truncatePlain(abs, places)
  }

  // grupo = floor(log10 / 3): 1→K, 10→No, 11→aa
  let group = abs.log10().div(3).floor()
  if (group.lt(1)) group = ONE

  let mantissa = forDisplay(abs.div(Decimal.pow(1000, group)), places)

  // Carry: 999.999… bumpado → 1000.00 → próximo sufixo
  if (mantissa.gte(1000)) {
    mantissa = forDisplay(mantissa.div(1000), places)
    group = group.plus(1)
  }

  const suffix = suffixForGroup(group)
  if (suffix === null) {
    return sign + formatScientific(abs, places)
  }

  return `${sign}${truncatePlain(mantissa, places)}${suffix}`
}

function suffixForGroup(group: Decimal): string | null {
  if (group.lte(LAST_NAMED_GROUP)) {
    return NAMED_SUFFIXES[group.toNumber()]
  }

  // grupo 11 → índice 0 → aa
  const letterIndex = group.minus(LAST_NAMED_GROUP + 1)
  return lettersFromIndex(letterIndex)
}

/**
 * 0 → aa, 1 → ab, …, 25 → az, 26 → ba, …, 675 → zz, 676 → aaa, …
 */
function lettersFromIndex(index: Decimal): string | null {
  if (index.lt(0) || !index.isFinite()) return null

  let len = 2
  let count = D(26).pow(len)
  let remaining = D(index)

  while (remaining.gte(count)) {
    remaining = remaining.minus(count)
    len += 1
    if (len > MAX_LETTER_LEN) return null
    count = D(26).pow(len)
  }

  let s = ''
  let x = remaining
  for (let i = 0; i < len; i++) {
    const digit = x.mod(26).floor().toNumber()
    s = String.fromCharCode(97 + digit) + s
    x = x.div(26).floor()
  }
  return s
}

function formatScientific(abs: Decimal, places: number): string {
  const log10 = abs.log10()
  let exp = log10.floor()
  let mantissa = abs.div(Decimal.pow(10, exp))
  mantissa = forDisplay(mantissa, places)

  if (mantissa.gte(10)) {
    mantissa = mantissa.div(10)
    exp = exp.plus(1)
    mantissa = forDisplay(mantissa, places)
  }

  return `${truncatePlain(mantissa, places)}e${exp.toString()}`
}

/** Escreve um Decimal finito pequeno como "int.frac" truncado, sem toFixed/round. */
function truncatePlain(value: Decimal, places: number): string {
  const abs = value.abs()
  const factor = Decimal.pow(10, places)
  const scaled = abs.times(factor).trunc()
  const intPart = scaled.div(factor).floor()
  const fracPart = scaled.mod(factor).floor()
  const fracStr = fracPart.toString().padStart(places, '0')
  const intStr =
    intPart.lt(1e15) && intPart.eq(intPart.floor())
      ? String(Math.trunc(intPart.toNumber()))
      : intPart.toString()
  return `${intStr}.${fracStr}`
}

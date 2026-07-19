import './style.css'
import {
  GENERATORS,
  buyGenerator,
  formatNumber,
  getCost,
  productionOf,
  targetLabel,
  tick,
  type GameState,
} from './game'
import { loadGame, resetSave, saveGame } from './save'

const app = document.querySelector<HTMLDivElement>('#app')!

const generatorRows = GENERATORS.map(
  (gen, i) => `
    <div class="card row" data-tier="${i}">
      <div class="row-main">
        <span class="name">
          <span class="name-full">Gerador ${gen.id}</span>
          <span class="name-short">G${gen.id}</span>
        </span>
        <div class="qty">
          <span class="amount" data-amount></span>
          <span class="prod" data-prod></span>
        </div>
        <div class="meta">
          <span class="rate">+${gen.rate.toString()}/s</span>
          <span class="target">${targetLabel(i)}</span>
        </div>
      </div>
      <button type="button" class="buy-btn" data-buy disabled></button>
    </div>
  `,
).join('')

app.innerHTML = `
  <main class="column">
    <div class="stack">
      <div class="card" id="row-base">
        <div class="base-toolbar">
          <button type="button" id="btn-reset">Resetar save</button>
          <span class="fps" id="fps">FPS: --</span>
        </div>
        <span class="name">Recurso base</span>
        <div class="stats">
          <span class="amount" id="base-amount">0.00</span>
          <span class="prod" id="base-rate">+0.00/s</span>
        </div>
      </div>

      ${generatorRows}
    </div>
  </main>
`

const baseAmount = document.querySelector('#base-amount')!
const baseRate = document.querySelector('#base-rate')!
const btnReset = document.querySelector<HTMLButtonElement>('#btn-reset')!
const fpsEl = document.querySelector('#fps')!
const tierRows = GENERATORS.map((_, i) => {
  const row = document.querySelector<HTMLElement>(`.row[data-tier="${i}"]`)!
  return {
    row,
    amount: row.querySelector<HTMLElement>('[data-amount]')!,
    prod: row.querySelector<HTMLElement>('[data-prod]')!,
    buy: row.querySelector<HTMLButtonElement>('[data-buy]')!,
  }
})

let state: GameState = loadGame()
let lastTime = performance.now()
let lastSaveAt = performance.now()

/** Contador de FPS fiel: frames reais / tempo real, janela de 1s. */
let fpsFrames = 0
let fpsWindowStart = performance.now()

/** Mostra geradores já comprados + o próximo a desbloquear. */
function isTierVisible(index: number, bought: GameState['bought']): boolean {
  if (bought[index].gt(0)) return true
  const next = bought.findIndex((b) => b.eq(0))
  return next === index
}

function render() {
  baseAmount.textContent = formatNumber(state.base)
  baseRate.textContent = `+${formatNumber(productionOf(state, -1))}/s`

  for (let i = 0; i < GENERATORS.length; i++) {
    const visible = isTierVisible(i, state.bought)
    const ui = tierRows[i]
    ui.row.hidden = !visible
    if (!visible) continue

    const cost = getCost(i, state.bought[i])
    const canBuy = state.base.gte(cost)

    ui.amount.textContent = formatNumber(state.gens[i])
    const growth = productionOf(state, i)
    ui.prod.textContent = growth.eq(0) ? '-' : `+${formatNumber(growth)}/s`
    ui.buy.textContent = formatNumber(cost)
    ui.buy.disabled = !canBuy
  }
}

for (let i = 0; i < GENERATORS.length; i++) {
  tierRows[i].buy.addEventListener('click', () => {
    state = buyGenerator(state, i)
    saveGame(state)
    render()
  })
}

btnReset.addEventListener('click', () => {
  const ok = window.confirm('Resetar o save? Todo o progresso será perdido.')
  if (!ok) return
  state = resetSave()
  lastTime = 0
  lastSaveAt = performance.now()
  fpsFrames = 0
  fpsWindowStart = performance.now()
  fpsEl.textContent = 'FPS: --'
  render()
})

window.addEventListener('beforeunload', () => {
  saveGame(state)
})

function updateFps(now: number) {
  fpsFrames += 1
  const elapsed = now - fpsWindowStart
  // Janela de 1s: erro relativo bem menor que 500ms; usa o tempo real medido
  if (elapsed < 1000) return

  const fps = (fpsFrames * 1000) / elapsed
  // Inteiro mais próximo do valor medido (fiel ao refresh real)
  fpsEl.textContent = `FPS: ${Math.round(fps)}`
  fpsFrames = 0
  fpsWindowStart = now
}

function loop(now: number) {
  updateFps(now)

  if (lastTime === 0) {
    lastTime = now
    render()
    requestAnimationFrame(loop)
    return
  }

  const dt = Math.min(Math.max(0, (now - lastTime) / 1000), 0.1)
  lastTime = now
  state = tick(state, dt)

  if (now - lastSaveAt >= 5000) {
    saveGame(state)
    lastSaveAt = now
  }

  render()
  requestAnimationFrame(loop)
}

render()
requestAnimationFrame(loop)

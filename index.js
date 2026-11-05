/**
 * «Расход-живой» — учёт токенов сессии в реальном времени.
 *
 * Статус 0.1.0: заготовка. Контур слушания рабочий, числа — ОЦЕНКИ
 * (tokenMeter — оценщик харнесса, не биллинг; точный usage — доработка,
 * см. INTERNAL.md «неизвестные»).
 *
 * Принцип (ARCH.md): слушаем журнал сессий, меряем tokenMeter'ом, пишем в
 * ОДИН промежуточный файл (JSONL append). РАСХОД.db не касаемся — там
 * якорь и валидация (П-69). Сбой записи не роняет сессию: ошибка в лог.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export const name = 'dsh-rashod-live'
export const inject = ['tokenMeter']

// Схема Config (schemastery/zod) подключается на доводке — см. INTERNAL.md;
// пока читаем конфиг защитно, сайт-конфиг живёт в cordis.patch.yml.
export function apply(ctx, config = {}) {
  const file = config.file
  if (typeof file !== 'string' || file === '') {
    console.warn('[rashod-live] config.file не задан — плагин неактивен')
    return
  }
  const enabled = () => config.enabled !== false
  mkdirSync(path.dirname(file), { recursive: true })

  const write = (line) => {
    try {
      appendFileSync(file, JSON.stringify(line) + '\n', 'utf8')
    } catch (error) {
      console.error('[rashod-live] запись не удалась:', error?.message ?? error)
    }
  }

  // НЕИЗВЕСТНЫЙ №1 (INTERNAL.md): точные строки durable-событий в
  // event.type. Ставим конец хода; сверить инспекцией Event/журналом.
  ctx.effect(() => ctx.on('session/event', function (session, event) {
    if (!enabled() || event?.type !== 'turn/end') return
    try {
      const measurement = ctx.tokenMeter.measure(session)
      const pressure = ctx.tokenMeter.contextPressure(session)
      write({
        ts: new Date().toISOString(),
        sessionId: String(session.id),
        kind: 'оценка',
        source: 'tokenMeter',
        totalTokens: measurement?.totalTokens ?? null,
        surfaceTokens: measurement?.surfaceTokens ?? null,
        baseline: measurement?.baseline?.kind ?? null,
        pressureTokens: pressure?.pressureTokens ?? null,
        contextWindow: pressure?.contextWindow ?? null,
        task: config.task ?? '—',
        model: config.model || null,
      })
    } catch (error) {
      console.error('[rashod-live] замер не удался:', error?.message ?? error)
    }
  }), 'rashod-live.session-event')
}

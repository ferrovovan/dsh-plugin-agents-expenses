/**
 * «Расход-живой» — учёт токенов сессии в реальном времени.
 *
 * Статус 0.1.1: контур подтверждён замером живых журналов (этап 0):
 * закрытие хода — `turn/end` (событийные строки в INTERNAL.md), а точный
 * usage лежит прямо в потоке — `assistant/message → data.usage`, поэтому
 * вторая линия строк пишется с kind:"замер". Оценочная линия tokenMeter
 * сохранена (контракт v1 не ломается: поля не удаляются, только
 * добавляются — см. ARCH.md №3 и INTERNAL.md).
 *
 * Принцип (ARCH.md): слушаем журнал сессий, пишем в ОДИН промежуточный
 * файл (JSONL append). РАСХОД.db не касаемся — там якорь и валидация
 * (П-69). Сбой записи не роняет сессию: ошибка в лог.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export const name = 'dsh-rashod-live'
export const inject = ['tokenMeter']

// Схема Config (schemastery/zod) намеренно НЕ подключена: family-правило
// «без npm-зависимостей» + нерешённый резолв linked-бандла (INTERNAL №4
// закрыт решением), читаем конфиг защитно.
export function apply(ctx, config = {}) {
  const file = config.file
  if (typeof file !== 'string' || file === '') {
    console.warn('[rashod-live] config.file не задан — плагин неактивен')
    return
  }
  const enabled = () => config.enabled !== false
  mkdirSync(path.dirname(file), { recursive: true })

  const write = (line) => {
    if (!enabled()) return
    try {
      appendFileSync(file, JSON.stringify(line) + '\n', 'utf8')
    } catch (error) {
      console.error('[rashod-live] запись не удалась:', error?.message ?? error)
    }
  }

  ctx.effect(() => ctx.on('session/event', function (session, event) {
    if (!enabled() || !event) return
    const sessionId = String(session?.id ?? '')

    // Линия замеров: биллинг-usage из события ассистента (замер этапа 0:
    // data.usage = {inputTokens, outputTokens, totalTokens}).
    if (event.type === 'assistant/message') {
      const usage = event.data?.usage
      if (!usage) return
      write({
        ts: new Date().toISOString(),
        sessionId,
        kind: 'замер',
        source: 'assistant/message',
        totalTokens: Number(usage.totalTokens ?? 0),
        surfaceTokens: null,
        baseline: 'usage',
        pressureTokens: null,
        contextWindow: null,
        task: config.task ?? '—',
        model: config.model || null,
        // аддитивные поля v1.x (ARCH №3: только добавления):
        turn: event.data?.turn ?? null,
        step: event.data?.step ?? null,
        inputTokens: Number(usage.inputTokens ?? 0),
        outputTokens: Number(usage.outputTokens ?? 0),
      })
      return
    }

    // Оценочная линия на закрытие хода (v1, tokenMeter — оценщик).
    if (event.type !== 'turn/end') return
    try {
      const measurement = ctx.tokenMeter.measure(session)
      const pressure = ctx.tokenMeter.contextPressure(session)
      write({
        ts: new Date().toISOString(),
        sessionId,
        kind: 'оценка',
        source: 'tokenMeter',
        totalTokens: measurement?.totalTokens ?? null,
        surfaceTokens: measurement?.surfaceTokens ?? null,
        baseline: measurement?.baseline?.kind ?? null,
        pressureTokens: pressure?.pressureTokens ?? null,
        contextWindow: pressure?.contextWindow ?? null,
        task: config.task ?? '—',
        model: config.model || null,
        // аддитивные поля v1.x:
        turn: event.data?.turn ?? null,
        reason: event.data?.reason?.kind ?? null,
      })
    } catch (error) {
      console.error('[rashod-live] замер не удался:', error?.message ?? error)
    }
  }), 'rashod-live.session-event')
}

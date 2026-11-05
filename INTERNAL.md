# INTERNAL — как устроено сейчас (0.1.0)

`index.js:apply` → слушатель `session/event` → фильтр `event.type ===
'turn/end'` → `tokenMeter.measure/contextPressure` → append JSONL.

## Неизвестные (закрыть до 0.2.0; каждый — точный способ проверки)

1. **Строки durable-событий.** ЗАКРЫТ 2026-11-05 (этап 0; замер живых
   zstd-журналов `~/.dsh/sessions/**/session.v4.jsonl.zstd`): закрытие
   хода — ровно `event.type === 'turn/end'`, `data:{turn, reason:{kind:
   "completed"}}`, при отмене — `reason:{kind:"aborted",
   reason:{kind:"user"}}`. Фильтр 0.1.0 верен. В том же потоке:
   `turn/start`, `step/start`, `step/end`, `tool/call`, `tool/result`,
   `assistant/message`. Сырой журнал виден и в GUI (Session Inspector,
   Raw log) — инструмент проверки этапа 2.
2. **Точный usage вместо оценки.** ЗАКРЫТ (замер): `assistant/message →
   data.usage = {inputTokens, outputTokens, totalTokens}` лежит прямо в
   событии потока `session/event` — `kind:"замер"` возможен из событий,
   не только из `tokenMeter`. Сверку `baseline.kind === 'usage'` у
   measure делать на этапе 2 (это поведение плагина на живой сессии).
3. **Scoped-слушатель.** Убедиться, что `ctx.on('session/event')`
   хост-уровня получает события всех сессий; если нет — регистрировать на
   `agent/created` в `agent.ctx.effect` (канон practices.md).
4. **Схема Config.** Подключить `@deepseek-ai/schemastery` (zod-подобная)
   для `export const Config`; при linked-установке проверить резолв
   зависимости из профиля (иначе — держать зависимости в node_modules
   umbrella-каталога).

## Как проверить заготовку без риска

Установить (enabled:false) → убедиться, что строки в логе нет → включить
на одной короткой сессии → увидеть JSONL → выключить.

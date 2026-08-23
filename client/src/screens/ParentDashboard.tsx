import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { getActivity, minutesPerDay, averageScoreByKind, weakPhonemes, clearActivity } from '../progress/activity'
import { clearLeitner } from '../progress/leitner'
import { listRecordings, clearRecordings } from '../progress/recordings'
import type { Recording } from '../progress/recordings'
import { clearStars } from '../progress/store'
import { getLimitMinutes, setLimitMinutes } from '../progress/limit'
import { PHONEME_TIPS } from '../scoring/feedback'
import { playBlob } from '../audio/player'
import { Button, Card } from '../components/ui'

const KIND_LABEL = { speak: 'Nói', word: 'Từ vựng', sentence: 'Ghép câu' } as const
const LIMIT_CHIPS = [15, 20, 30] as const

function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${min}`
}

type Props = {
  /** Clears the parent-gate flag and hands control back to ParentGate, which owns the
   * unlocked/locked state. Optional so the component still renders standalone in tests. */
  onLock?: () => void
}

export function ParentDashboard({ onLock }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  // One read of the activity log per mount (and per reset), shared by every query below; the
  // snapshot doubles as the reload key for the recordings list.
  const [snapshot, setSnapshot] = useState(() => ({ events: getActivity(), now: Date.now() }))
  const [limit, setLimit] = useState<string>(() => String(getLimitMinutes()))

  const { events, now } = snapshot
  const days = minutesPerDay(14, now, events)
  const todayKey = days[days.length - 1]?.day
  const limitMinutes = getLimitMinutes()
  const scaleMax = Math.max(1, limitMinutes, ...days.map(d => d.minutes))
  const targetTopPct = Math.min(100, Math.max(0, 100 - (limitMinutes / scaleMax) * 100))
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0)
  const weekMinutes = minutesPerDay(7, now, events).reduce((sum, d) => sum + d.minutes, 0)
  const averages = averageScoreByKind(events)
  const kindAverages = Object.values(averages).filter((v): v is number => v != null)
  const avgScoreLabel = kindAverages.length
    ? String(Math.round(kindAverages.reduce((sum, v) => sum + v, 0) / kindAverages.length))
    : '—'
  const weak = weakPhonemes(5, events)

  useEffect(() => {
    let cancelled = false
    listRecordings().then(list => {
      if (!cancelled) setRecordings(list)
    })
    return () => { cancelled = true }
  }, [snapshot])

  function handleLimitChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setLimit(raw)
    setLimitMinutes(Number(raw))
  }

  function handleLimitBlur() {
    setLimit(String(getLimitMinutes()))
  }

  function handleLimitChip(n: number) {
    setLimit(String(setLimitMinutes(n)))
  }

  async function handleReset() {
    if (!window.confirm('Xoá toàn bộ sao, lịch sử và bản ghi?')) return
    clearStars()
    clearActivity()
    clearLeitner()
    await clearRecordings()
    setLimit(String(getLimitMinutes()))
    setSnapshot({ events: getActivity(), now: Date.now() })
  }

  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6 text-base text-ink-500">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Link
          to="/"
          className="inline-flex min-h-[64px] items-center gap-2 self-start rounded-full bg-white px-6 font-display text-xl font-extrabold text-ink-900 shadow-card-sm active:translate-y-[2px]"
        >
          ← Về nhà
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[36px] font-extrabold text-ink-900">Góc phụ huynh</h1>
            <p className="mt-1 font-semibold text-ink-500">
              Tuần này: {weekMinutes} phút luyện · điểm phát âm trung bình {avgScoreLabel}/100
            </p>
          </div>

          <button
            type="button"
            onClick={() => onLock?.()}
            className="flex min-h-[64px] items-center gap-2 rounded-xl2 border border-line-200 bg-white px-5 font-semibold text-ink-500 active:translate-y-[2px]"
          >
            <span>🔐 Đã mở khoá bằng câu hỏi ·</span>
            <span className="font-display font-extrabold text-ink-900">Khoá lại</span>
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6">
            <Card className="p-6">
              <h2 className="font-display text-xl font-extrabold text-ink-900">Phút luyện mỗi ngày (14 ngày)</h2>
              <p className="mb-4 mt-1 text-sm font-semibold text-ink-500">Mục tiêu {limitMinutes} phút/ngày</p>

              <div className="relative h-40">
                <div className="absolute inset-x-0 border-t-2 border-dashed border-ink-300" style={{ top: `${targetTopPct}%` }} />
                <div className="absolute inset-0 flex items-end gap-1">
                  {days.map(d => (
                    <div key={d.day} className="flex h-full flex-1 items-end">
                      <div
                        data-testid="minute-bar"
                        data-minutes={d.minutes}
                        className={`w-full rounded-t ${d.day === todayKey ? 'bg-coral-500' : 'bg-teal-500'}`}
                        style={{ height: `${Math.max(2, (d.minutes / scaleMax) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                {days.map(d => (
                  <span key={d.day} className="flex-1 text-center text-[10px] font-bold text-ink-300">{formatDayLabel(d.day)}</span>
                ))}
              </div>
              <p className="mt-3 text-sm font-semibold text-ink-500">Tổng: {totalMinutes} phút</p>
            </Card>

            <div>
              <h2 className="mb-3 font-display text-xl font-extrabold text-ink-900">Điểm trung bình</h2>
              <div className="grid grid-cols-3 gap-3">
                {(['speak', 'word', 'sentence'] as const).map(kind => (
                  <Card key={kind} className="flex flex-col items-center gap-1 p-5 text-center">
                    <span className="text-sm font-bold text-ink-500">{KIND_LABEL[kind]}</span>
                    <span className="font-display text-[40px] font-extrabold text-ink-900">
                      {averages[kind] != null ? Math.round(averages[kind]!) : '—'}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="p-6">
              <h2 className="mb-3 font-display text-xl font-extrabold text-ink-900">Âm hay sai</h2>
              {weak.length === 0 ? (
                <p>Chưa đủ dữ liệu</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {weak.map(w => (
                    <li key={w.phoneme} className="flex flex-col gap-2">
                      <p className="inline-flex w-fit items-center rounded-full bg-fix-50 px-4 py-2 font-display text-lg font-extrabold text-fix-700">
                        /{w.phoneme}/ — trung bình {Math.round(w.avg)} ({w.count} lần)
                      </p>
                      {PHONEME_TIPS[w.phoneme] && (
                        <p className="rounded-xl2 bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700">{PHONEME_TIPS[w.phoneme]}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-3 font-display text-xl font-extrabold text-ink-900">Bản ghi gần đây</h2>
              {recordings.length === 0 ? (
                <p>Chưa có bản ghi</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {recordings.map(r => (
                    <li key={r.id} className="flex items-center gap-3 rounded-xl2 border border-line-200 p-3">
                      <button
                        type="button"
                        aria-label="Phát"
                        onClick={() => { playBlob(r.blob).catch(() => { /* ignore: playback unavailable */ }) }}
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-500 text-2xl text-white shadow-chunky-teal active:translate-y-[2px]"
                      >
                        ▶
                      </button>
                      <div>
                        <p className="text-xs font-bold text-ink-300">{formatTs(r.ts)}</p>
                        <p className="font-semibold text-ink-900">{r.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-3 font-display text-xl font-extrabold text-ink-900">Giới hạn mỗi ngày</h2>
              <div className="flex gap-2">
                {LIMIT_CHIPS.map(n => {
                  const active = Number(limit) === n
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleLimitChip(n)}
                      className={`min-h-[64px] flex-1 rounded-xl2 font-display text-base font-extrabold active:translate-y-[2px] ${
                        active ? 'bg-coral-500 text-white shadow-chunky-coral' : 'border-2 border-line-200 bg-cream-50 text-ink-500'
                      }`}
                    >
                      {n} phút
                    </button>
                  )
                })}
              </div>
              <label className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={60}
                  step={5}
                  value={limit}
                  onChange={handleLimitChange}
                  onBlur={handleLimitBlur}
                  className="h-16 w-24 rounded-xl2 border-2 border-line-200 px-3 text-center font-display text-lg font-extrabold text-ink-900"
                />
                <span className="font-semibold text-ink-500">phút / ngày</span>
              </label>
            </Card>
          </div>
        </div>

        <Button variant="outline" onClick={handleReset} className="self-start">
          Đặt lại tiến trình
        </Button>
      </div>
    </main>
  )
}

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

const KIND_LABEL = { speak: 'Nói', word: 'Từ vựng', sentence: 'Ghép câu' } as const

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

export function ParentDashboard() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  // One read of the activity log per mount (and per reset), shared by every query below; the
  // snapshot doubles as the reload key for the recordings list.
  const [snapshot, setSnapshot] = useState(() => ({ events: getActivity(), now: Date.now() }))
  const [limit, setLimit] = useState<string>(() => String(getLimitMinutes()))

  const { events, now } = snapshot
  const days = minutesPerDay(14, now, events)
  const maxMinutes = Math.max(1, ...days.map(d => d.minutes))
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0)
  const averages = averageScoreByKind(events)
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
    <main className="h-full overflow-y-auto p-6 text-base text-slate-700 flex flex-col gap-8 max-w-2xl mx-auto">
      <Link to="/" className="min-h-[64px] self-start inline-flex items-center font-semibold">← Về nhà</Link>

      <section>
        <h2 className="text-lg font-semibold mb-3">Phút luyện mỗi ngày (14 ngày)</h2>
        <div className="flex items-end h-40 gap-1">
          {days.map(d => (
            <div key={d.day} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
              <div
                data-testid="minute-bar"
                data-minutes={d.minutes}
                className="w-full bg-teal rounded-t"
                style={{ height: `${Math.max(2, (d.minutes / maxMinutes) * 100)}%` }}
              />
              <span className="text-xs text-slate-500">{formatDayLabel(d.day)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2">Tổng: {totalMinutes} phút</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Điểm trung bình</h2>
        <ul className="flex flex-col gap-1">
          {(['speak', 'word', 'sentence'] as const).map(kind => (
            <li key={kind} className="flex justify-between">
              <span>{KIND_LABEL[kind]}</span>
              <span>{averages[kind] != null ? Math.round(averages[kind]!) : '—'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Âm hay sai</h2>
        {weak.length === 0 ? (
          <p>Chưa đủ dữ liệu</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {weak.map(w => (
              <li key={w.phoneme}>
                <p>/{w.phoneme}/ — trung bình {Math.round(w.avg)} ({w.count} lần)</p>
                {PHONEME_TIPS[w.phoneme] && <p className="text-sm text-slate-500">{PHONEME_TIPS[w.phoneme]}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Bản ghi gần đây</h2>
        {recordings.length === 0 ? (
          <p>Chưa có bản ghi</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recordings.map(r => (
              <li key={r.id} className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Phát"
                  onClick={() => { playBlob(r.blob).catch(() => { /* ignore: playback unavailable */ }) }}
                  className="min-h-[64px] min-w-[64px] rounded-2xl bg-white shadow flex items-center justify-center text-xl"
                >
                  ▶
                </button>
                <div>
                  <p className="text-sm text-slate-500">{formatTs(r.ts)}</p>
                  <p>{r.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Giới hạn mỗi ngày</h2>
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={60}
            step={5}
            value={limit}
            onChange={handleLimitChange}
            onBlur={handleLimitBlur}
            className="min-h-[64px] border-2 border-slate-300 rounded-xl px-3 w-24"
          />
          <span>phút / ngày</span>
        </label>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Đặt lại tiến trình</h2>
        <button
          type="button"
          onClick={handleReset}
          className="min-h-[64px] px-4 rounded-2xl bg-white shadow font-semibold"
        >
          Đặt lại tiến trình
        </button>
      </section>
    </main>
  )
}

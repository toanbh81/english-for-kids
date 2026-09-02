// Build contact sheets: one row per screen state, columns phone | iPad landscape | iPad portrait.
// Each sheet is a PNG so it can be dropped into Claude Design as a single reference image.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const SHOTS = path.resolve('shots')
const OUT = path.join(SHOTS, 'sheets')
fs.mkdirSync(OUT, { recursive: true })

// [file base, inventory id, label] — order = document order.
const ROWS = [
  ['home-fresh', 'A3', 'Home — máy mới, chưa có lịch sử (có link "Đã dùng Speak Up rồi?")'],
  ['home', 'A3', 'Home — đã học 5 ngày'],
  ['home-over-limit', 'A3', 'Home — hết giờ hôm nay (banner)'],
  ['home-ios-a2hs', 'A3', 'Home — iPhone Safari, banner Thêm vào màn hình chính'],
  ['profile-gate', 'A1', 'ProfileGate — chọn hồ sơ (3 hồ sơ, 1 tên dài)'],
  ['mission', 'A6', 'DailyMission — nhiệm vụ hôm nay'],
  ['mission-done', 'A7', 'MissionComplete'],
  ['topic-animals', 'A8', 'TopicHub — đảo Động vật'],
  ['topic-locked', 'A8', 'TopicHub — đảo khoá'],
  ['levels', 'A9', 'LevelStairs — các bậc luyện nói'],
  ['level-word-pop', 'A10', 'LevelSelect — Word Pop (12 thẻ)'],
  ['level-sound-zoo', 'A11', 'SoundLevel — Tập âm (9 âm)'],
  ['level-pairs', 'A12', 'PairLevel — Nghe & chọn (8 cặp)'],
  ['level-stars', 'A13', 'StarLevel — Sentence Stars (10 câu)'],
  ['level-voice', 'A14', 'VoiceLevel — Story Voice (8 đoạn)'],
  ['level-notfound', 'A10', 'LevelSelect — không tìm thấy'],
  ['start-menu', 'A2', 'CloudStart — menu'],
  ['start-gate', 'A2', 'CloudStart — câu hỏi phụ huynh'],
  ['start-gate-wrong', 'A2', 'CloudStart — trả lời sai'],
  ['start-email', 'A2', 'CloudStart — nhập email'],
  ['start-code', 'A2', 'CloudStart — nhập mã khôi phục'],
  ['practice-idle', 'B1', 'PracticeCard — Word Pop "cat", idle'],
  ['practice-ipa-hidden', 'B1', 'PracticeCard — Word Pop, IPA ẩn ("Xem phiên âm")'],
  ['sound-list', 'B2', 'SoundWordList — âm /θ/'],
  ['sound-practice-idle', 'B3', 'SoundPractice — idle'],
  ['pair-listen', 'B4', 'PairPractice — pha nghe, chưa bấm loa'],
  ['pair-listen-armed', 'B4', 'PairPractice — đã phát, chờ chọn'],
  ['star-idle', 'B5', 'StarPractice — idle'],
  ['voice-idle', 'B6', 'VoicePractice — idle'],
  ['stories', 'C1', 'StoryList'],
  ['story-player', 'C2', 'StoryPlayer — chưa bắt đầu'],
  ['story-player-playing', 'C2', 'StoryPlayer — đang phát (karaoke)'],
  ['story-player-ended', 'C2', 'StoryPlayer — hết truyện ("Tiếp tục ▸")'],
  ['quiz-idle', 'C3', 'StoryQuiz — câu hỏi'],
  ['quiz-wrong', 'C3', 'StoryQuiz — chọn sai'],
  ['quiz-correct', 'C3', 'StoryQuiz — chọn đúng'],
  ['quiz-result', 'C3', 'StoryQuiz — kết quả 3/3'],
  ['retell-idle', 'C4', 'StoryRetell — idle'],
  ['words', 'C5', 'WordTopics'],
  ['words-animals', 'C6', 'WordList — Động vật'],
  ['words-review-empty', 'C6', 'WordList — ôn tập rỗng'],
  ['word-guess', 'C7', 'WordCard — đoán nghĩa'],
  ['word-guess-wrong', 'C7', 'WordCard — đoán sai'],
  ['word-guess-correct', 'C7', 'WordCard — đoán đúng, chờ "Tiếp theo"'],
  ['word-card-front', 'C7', 'WordCard — mặt trước'],
  ['word-card-back', 'C7', 'WordCard — mặt sau'],
  ['sentences', 'C8', 'SentenceList — tất cả'],
  ['sentences-topic', 'C8', 'SentenceList — lọc 1 chủ đề'],
  ['sentence-empty', 'C9', 'SentenceBuilder — khay rỗng (câu 6 ô)'],
  ['sentence-partial', 'C9', 'SentenceBuilder — đang xếp'],
  ['sentence-wrong', 'C9', 'SentenceBuilder — xếp sai (rung rồi xoá khay)'],
  ['sentence-correct', 'C9', 'SentenceBuilder — đúng, hiện mic'],
  ['parent-gate', 'P1', 'ParentGate'],
  ['parent-gate-wrong', 'P1', 'ParentGate — sai'],
  ['parent-dashboard', 'P2', 'ParentDashboard — phần trên (xem *-full.png để thấy toàn bộ)'],
  ['parent-dashboard-profiles', 'P2', 'ParentDashboard — 3 hồ sơ (ProfilePicker)'],
]
const COLS = [['phone', 'Phone 390×844'], ['ipad', 'iPad ngang 1194×834'], ['ipadp', 'iPad dọc 834×1194']]
const PER_SHEET = 7
const H = 520 // row image height in CSS px

const exists = p => fs.existsSync(p)
const dataUri = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 2400, height: 1000 }, deviceScaleFactor: 1 })
let n = 0
for (let i = 0; i < ROWS.length; i += PER_SHEET) {
  const chunk = ROWS.slice(i, i + PER_SHEET)
  const rows = chunk.map(([base, id, label]) => {
    const cells = COLS.map(([vp, vlabel]) => {
      const f = path.join(SHOTS, vp, base + '.png')
      const full = path.join(SHOTS, vp, base + '-full.png')
      if (!exists(f)) return `<td class="miss">—</td>`
      const note = exists(full) ? `<div class="note">⚠ tràn — xem ${vp}/${base}-full.png</div>` : ''
      return `<td><img src="${dataUri(f)}" style="height:${H}px">${note}</td>`
    }).join('')
    return `<tr><th><span class="id">${id}</span><br>${label}<br><code>${base}.png</code></th>${cells}</tr>`
  }).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font:14px/1.35 system-ui,Segoe UI,sans-serif;color:#333}
    h1{font-size:18px;margin:16px 20px 6px} .sub{margin:0 20px 10px;color:#777}
    table{border-collapse:collapse;margin:0 20px 20px} th,td{border:1px solid #ddd;padding:10px;vertical-align:top;text-align:left}
    th{width:260px;background:#fafafa;font-weight:600} th code{font-weight:400;color:#888;font-size:12px}
    .id{display:inline-block;background:#FF7A59;color:#fff;border-radius:6px;padding:1px 6px;font-size:12px;margin-bottom:4px}
    thead th{background:#4A3B33;color:#fff} img{display:block;border:1px solid #ccc;background:#FFF7EA}
    .note{color:#C2354B;font-size:12px;margin-top:4px} .miss{color:#bbb;text-align:center}
  </style>
  <h1>Speak Up! — ảnh chụp app hiện tại, sheet ${n + 1}/${Math.ceil(ROWS.length / PER_SHEET)}</h1>
  <p class="sub">Mã A/B/C/P trỏ về docs/design/2026-09-02-screen-inventory-for-redesign.md §3. Chụp 2026-09-02, dev build, engine Web Speech (không có Azure) nên badge "chế độ đơn giản" hiện ở mọi màn luyện.</p>
  <table><thead><tr><th>Màn / trạng thái</th>${COLS.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
  await page.setContent(html)
  await page.evaluate(() => document.fonts?.ready)
  const file = path.join(OUT, `sheet-${String(n + 1).padStart(2, '0')}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log('wrote', file)
  n++
}
await browser.close()

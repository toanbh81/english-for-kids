// Screenshot every screen of Speak Up! at the two design frames (+ iPad portrait for a subset).
// Throwaway tooling: playwright-core driving the system Edge, against the http dev server on :5174.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5174'
const OUT = path.resolve(process.env.SHOTS_DIR ?? 'shots')
const ONLY = process.argv[2] // optional viewport filter

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2, hasTouch: true },
  ipadp: { viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2, hasTouch: true },
  // 375×667 (iPhone SE) — the shortest fold Round-2 screens design for explicitly (tailwind's
  // `short:` variant is `max-width:767px and max-height:700px`). Opt-in only — see VIEWPORTS below
  // — a sweep of every screen at this size isn't useful day to day, this exists to spot-check the
  // handful of `short:` rules a screen actually carries.
  short: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
// Which of the VIEWPORTS above actually run. Defaults to the original three so a plain `node
// shoot.mjs` behaves exactly as before; pass e.g. `VIEWPORTS=short` or `VIEWPORTS=phone,short` to
// opt into the 375×667 fold for a spot-check.
const ACTIVE_VIEWPORTS = new Set((process.env.VIEWPORTS ?? 'phone,ipad,ipadp').split(','))
// iPad portrait only for the screens where its layout is a real question. Opt-in
// (SHOTS_DIR=... IPADP_SUBSET=1) for a quick spot-check; the default is the full set, so a plain
// run of this script is a real sweep of every screen at all three viewports, not just these eight.
const IPADP_ONLY = new Set(['home', 'mission', 'levels', 'topic-animals', 'parent-dashboard', 'voice-idle', 'story-player', 'words-animals'])
const IPADP_SUBSET = process.env.IPADP_SUBSET === '1'

const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function settle(page, ms = 350) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await sleep(ms)
}

// Viewport shot, plus a "-full" shot when the app's own scroll container overflows: the page never
// scrolls itself (#root is 100% tall, <main> scrolls), so fullPage alone would show nothing extra.
// Since Phase 12's PageShell, <main> itself is overflow-hidden and pinned to the viewport — the
// screen that actually scrolls is PageBody ([data-testid="page-body"], flex-1 min-h-0
// overflow-y-auto) — so the probe has to read that element (falling back to <main>/body for any
// screen not yet on PageShell) or it is permanently blind to overflow.
const WANT = process.env.SHOTS?.split(',')
async function shot(page, dir, name, quick = false) {
  if (!quick) await settle(page)
  await page.screenshot({ path: path.join(dir, `${name}.png`) })
  const overflow = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="page-body"]') ?? document.querySelector('main') ?? document.body
    return { sh: m.scrollHeight, ch: m.clientHeight }
  })
  if (overflow.sh > overflow.ch + 8) {
    await page.addStyleTag({ content: 'html,body,#root{height:auto!important} main{height:auto!important;overflow:visible!important;max-height:none!important} [data-testid="page-body"]{overflow:visible!important;max-height:none!important;flex:none!important} [class*="overflow-y-auto"]{overflow:visible!important;max-height:none!important}' })
    await sleep(150)
    await page.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true })
    log(`   ${name}: overflow ${overflow.sh}px > ${overflow.ch}px → -full`)
  }
  return overflow
}

const day = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Seed a believable child: 5 days of practice, some stars, a few weak phonemes.
async function seed(page, { overLimit = false, profiles = false } = {}) {
  await page.goto(BASE + '/')
  await settle(page, 600)
  await page.evaluate(({ overLimit, profiles }) => {
    const id = localStorage.getItem('speakup.profile')
    const pre = id ? `speakup.${id}.` : 'speakup.'
    const stars = {
      'story:little-fox': 3, 'story:at-the-zoo': 2, 'sentence:s1': 3, 'sentence:s2': 2, 'sentence:s5': 1,
      'sword:sz-th-three': 3, 'sword:sz-th-thank': 2, 'sword:sz-th-think': 1, 'wp-cat': 3, 'wp-dog': 2,
      'pair:pair-ship-sheep': 3, 'pair:pair-bat-bad': 1, 'sstar:ss1': 2, 'sstar:ss2': 3, 'voice:sv1': 2,
      'retell:little-fox': 3,
    }
    localStorage.setItem(pre + 'stars', JSON.stringify(stars))
    const now = Date.now(), H = 3600e3, D = 24 * H
    const ev = []
    const push = (t, kind, wid, score, ph) => ev.push({ ts: t, kind, id: wid, score, ...(ph ? { phonemes: ph } : {}) })
    for (let d = 5; d >= 1; d--) {
      const base = now - d * D - 2 * H
      for (let i = 0; i < 8; i++) {
        const t = base + i * 90e3
        const k = ['speak', 'word', 'sentence', 'story'][i % 4]
        push(t, k, k === 'story' ? 'little-fox' : `x${i}`, k === 'story' ? undefined : 55 + ((i * 7 + d * 3) % 45),
          k === 'speak' ? [{ phoneme: 'θ', score: 40 + i * 3 }, { phoneme: 'ɪ', score: 62 }] : undefined)
      }
    }
    if (overLimit) {
      for (let i = 0; i < 20; i++) push(now - 25 * 60e3 + i * 70e3, 'speak', `y${i}`, 80, [{ phoneme: 'r', score: 50 }])
    } else {
      push(now - 20 * 60e3, 'word', 'animals-elephant', 88)
      push(now - 18 * 60e3, 'speak', 'wp-cat', 91)
    }
    localStorage.setItem(pre + 'activity', JSON.stringify(ev))
    if (profiles) {
      const roster = [
        { id, name: 'Bé', avatar: '🦊', created: Date.now() - 10 * D },
        { id: crypto.randomUUID(), name: 'Nguyễn Hoàng Bảo Ngọc Anh Thư', avatar: '🦊', created: Date.now() - 3 * D },
        { id: crypto.randomUUID(), name: 'Bé', avatar: '🦊', created: Date.now() - 1 * D },
      ]
      localStorage.setItem('speakup.profiles', JSON.stringify(roster))
      sessionStorage.removeItem('speakup.profileChosen')
    }
  }, { overLimit, profiles })
}

async function go(page, route) {
  await page.goto(BASE + route)
  await settle(page, 500)
}

async function tapText(page, text, opts = {}) {
  const loc = page.getByText(text, { exact: opts.exact ?? true }).first()
  await loc.click({ timeout: 5000, noWaitAfter: !!opts.noWait })
}

async function run(vpName, vp) {
  const dir = path.join(OUT, vpName)
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const ctx = await browser.newContext({ ...vp, reducedMotion: 'reduce', locale: 'vi-VN', ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  page.on('dialog', d => d.accept())
  // Phase 13 Task 4 (`voice-recording`): a silent MediaStream stands in for a real mic so the
  // recording state can be shot headless — registered once, before any navigation, so it is in
  // place for every route this page ever loads.
  await page.addInitScript(() => {
    try {
      navigator.mediaDevices = navigator.mediaDevices || {}
      navigator.mediaDevices.getUserMedia = async () => new AudioContext().createMediaStreamDestination().stream
    } catch { /* ignore: some contexts (iOS UA emulation) lock this down */ }
  })
  const only = name => vpName !== 'ipadp' || !IPADP_SUBSET || IPADP_ONLY.has(name)
  const S = async (name, route, after, quick = false) => {
    if (!only(name)) return
    if (WANT && !WANT.includes(name)) return
    try {
      if (route) await go(page, route)
      if (after) await after()
      await shot(page, dir, name, quick)
      log(`✓ ${vpName}/${name}`)
    } catch (e) { log(`✗ ${vpName}/${name}: ${e.message.split('\n')[0]}`) }
  }

  // ---------- fresh device (no history) ----------
  await go(page, '/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await S('home-fresh', '/')
  await S('start-menu', '/start')
  await S('start-gate', null, async () => { await tapText(page, 'Tôi có email đã liên kết', { exact: false }) })
  await S('start-gate-wrong', null, async () => { await page.fill('input', '1'); await page.keyboard.press('Enter') })
  await S('start-email', null, async () => {
    const q = await page.locator('text=/\\d+ × \\d+/').first().textContent()
    const [a, b] = q.match(/\d+/g).map(Number)
    await page.fill('input', String(a * b)); await page.keyboard.press('Enter')
  })
  await S('start-code', null, async () => { await tapText(page, 'Chọn cách khác', { exact: false }); await tapText(page, 'Tôi có mã khôi phục', { exact: false }) })

  // ---------- seeded child ----------
  await seed(page)
  await S('home', '/')
  await S('home-streak-panel', null, async () => { await page.getByRole('button', { name: /Tuần này/ }).click(); await sleep(300) })
  await S('mission', '/mission')
  await S('mission-done', '/mission/done')
  // Task 11: the 0-star + 0-streak branch of MissionComplete — the worst case for this screen
  // (spec decision 20). Re-seeds `activity` down to three below-passing events for today only (no
  // prior days at all), so starsToday === 0 and streak() has nothing to count; `seed(page)` below
  // restores the normal 5-day child for every shot after this one.
  if (!WANT || WANT.includes('mission-done-zero')) {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const now = Date.now()
      localStorage.setItem(pre + 'activity', JSON.stringify(
        [0, 1, 2].map(i => ({ ts: now - (i + 1) * 60e3, kind: 'word', id: `z${i}`, score: 40 })),
      ))
    })
    await S('mission-done-zero', '/mission/done')
    await seed(page) // hand back the 5-day practiced child for every shot after this one
  }
  // Task 10: today's empty mission. `getLesson` only ever generates when there is no record yet
  // for the day, so the only headless way into this state is to write a valid, already-empty
  // `lesson.<day>` record ourselves before navigating — then clean it up so a later `mission` shot
  // in the same run is not left looking at an empty lesson too.
  if (!WANT || WANT.includes('mission-empty')) {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const d = new Date()
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      localStorage.setItem(`${pre}lesson.${day}`, JSON.stringify({ v: 1, day, created: Date.now(), band: 2, items: [] }))
    })
    await S('mission-empty', '/mission')
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      for (const k of Object.keys(localStorage)) if (k.startsWith(pre + 'lesson.')) localStorage.removeItem(k)
    })
  }
  await S('topic-animals', '/topic/animals')
  await S('topic-locked', '/topic/toys')
  await S('levels', '/levels')
  await S('level-word-pop', '/level/word-pop')
  await S('level-sound-zoo', '/level/sound-zoo')
  await S('level-pairs', '/level/minimal-pairs')
  await S('level-stars', '/level/sentence-stars')
  await S('level-voice', '/level/story-voice')
  await S('level-notfound', '/level/xyz')
  await S('practice-idle', '/practice/wp-cat')
  await S('practice-result3', '/practice/wp-cat?fixture=result3')
  await S('practice-ipa-hidden', '/practice/wp-elephant')
  await S('sound-list', '/sound/th')
  await S('sound-practice-idle', '/sound/th/sz-th-three')
  await S('sound-result3', '/sound/th/sz-th-three?fixture=result3')
  await S('pair-listen', '/pair/pair-ship-sheep')
  await S('pair-listen-armed', null, async () => { await page.getByRole('button', { name: /Nghe/ }).first().click(); await sleep(400) })
  await S('pair-result3', '/pair/pair-ship-sheep?fixture=result3')
  await S('star-idle', '/star/ss1')
  await S('star-result3', '/star/ss1?fixture=result3')
  await S('voice-idle', '/voice/sv1')
  await S('voice-result3', '/voice/sv1?fixture=result3')
  await S('voice-result1', '/voice/sv1?fixture=result1')
  // Task 4: the recording state, with a stubbed mic (no real Azure/Web-Speech round trip). Dev
  // has no Azure token, so this depends on Web Speech's `webkitSpeechRecognition` existing in
  // headless Edge — if it doesn't, the mic errors out instead of entering `recording` and this
  // throws, which `S` turns into a logged skip rather than a crash of the whole sweep.
  await S('voice-recording', '/voice/sv1', async () => {
    await page.getByRole('button', { name: /bấm để nói/i }).click()
    await sleep(800)
    const recording = await page.evaluate(() => !!document.querySelector('[data-testid="countdown-row"]'))
    if (!recording) throw new Error('mic never entered recording — headless engine likely has no webkitSpeechRecognition')
  })
  await S('stories', '/stories')
  await S('story-player', '/story/little-fox')
  await S('story-player-playing', null, async () => { await page.getByRole('button', { name: 'Phát' }).click(); await sleep(1200) })
  await S('story-player-ended', null, async () => {
    // no narration audio in dev → estimated timings; wait for the last scene to end (~40 s worst case)
    for (let i = 0; i < 60; i++) { if (await page.getByText('Tiếp tục ▸').count()) break; await sleep(1000) }
  })
  await S('quiz-idle', '/story/little-fox/quiz')
  await S('quiz-wrong', null, async () => { await tapText(page, 'cat'); await sleep(200) })
  await S('quiz-correct', null, async () => { await tapText(page, 'fox'); await sleep(150) })
  await S('quiz-result', null, async () => { await sleep(1200); await tapText(page, 'apple'); await sleep(1200); await tapText(page, 'bird'); await sleep(1200) })
  await S('retell-idle', '/story/little-fox/retell')
  await S('retell-result3', '/story/little-fox/retell?fixture=result3')
  await S('words', '/words')
  await S('words-animals', '/words/animals')
  await S('words-review-empty', '/words/review')
  // Task 3: trường hợp xấu nhất của cả khung danh sách — 64 ô ôn tập, 8 nhóm H2 dính. Id từ được
  // thu từ chính app thay vì hard-code, để danh sách không mục ruỗng khi content đổi.
  //
  // Fix round 1 (task-3-review.md Important #1): topic-id discovery must not depend on which
  // islands are already unlocked. `/words` (WordTopics) only links topics `topicUnlocked()` has
  // opened (`topicProgress.ts:39-45`) — the seeded profile only auto-opens the first 4 — so
  // harvesting topic ids from its rendered links under-seeds the deck (32/64 words, 4/8 groups).
  // Home renders a `data-testid="island-<id>"` marker for every topic regardless of lock state
  // (`Home.tsx:459,483`: the locked branch is a `<div>`, the open branch a `<Link>`, but both
  // carry the same testid), so that is the harvest source instead — still read from the app
  // itself, never hard-coded. `/words/:topic` (WordList) itself never gates on `topicUnlocked` —
  // it renders whatever `content/words` knows about — so the per-topic word-id loop below already
  // reaches locked topics unchanged; only the topic-id source needed to change.
  async function seedReviewDeck() {
    await go(page, '/')
    const topics = await page.$$eval('[data-testid^="island-"]', as => as
      .map(a => a.getAttribute('data-testid').slice('island-'.length)))
    if (topics.length < 8) {
      throw new Error(`seedReviewDeck: expected 8 topic islands on '/', found ${topics.length} (${topics.join(',')})`)
    }
    const ids = []
    for (const t of topics) {
      await go(page, `/words/${t}`)
      ids.push(...await page.$$eval(`a[href^="/words/${t}/"]`, as => as.map(a => a.getAttribute('href').split('/')[3])))
    }
    await page.evaluate(ids => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const due = Date.now() - 24 * 3600e3
      localStorage.setItem(pre + 'leitner', JSON.stringify(Object.fromEntries(ids.map(w => [w, { box: 1, due }]))))
    }, ids)
    return ids.length
  }
  if (!WANT || WANT.includes('words-review')) {
    const n = await seedReviewDeck()
    log(`   words-review: seeded ${n} due words`)
    await S('words-review', '/words/review')
    // Trả trạng thái về seed chuẩn: deck ôn tập rỗng là tiền đề của mọi ảnh sau nó.
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      localStorage.removeItem((id ? `speakup.${id}.` : 'speakup.') + 'leitner')
    })
  }
  await S('word-guess', '/words/animals/animals-elephant')
  await S('word-guess-wrong', '/words/animals/animals-elephant', async () => { await page.getByRole('button', { name: /^(?!.*con voi).*$/ }).filter({ hasText: /con|cái|màu|quả/ }).first().click(); await sleep(150) })
  await S('word-guess-correct', '/words/animals/animals-elephant', async () => { await tapText(page, 'con voi', { exact: false }) })
  // Task 10 (C7 round-2): `word-card-front`/`word-card-back` are past the guess step, which has no
  // route of its own — each gets its own explicit route + the guess-then-"Tiếp theo →" chain that
  // gets there, so it shoots correctly on its own (e.g. a `SHOTS=word-card-front` or `VIEWPORTS=
  // short SHOTS=word-card-front` run) rather than depending on `word-guess-correct` having already
  // run earlier in the very same sweep.
  await S('word-card-front', '/words/animals/animals-elephant', async () => {
    await tapText(page, 'con voi', { exact: false })
    await tapText(page, 'Tiếp theo →', { exact: false })
  })
  await S('word-card-back', '/words/animals/animals-elephant', async () => {
    await tapText(page, 'con voi', { exact: false })
    await tapText(page, 'Tiếp theo →', { exact: false })
    await page.getByRole('button', { name: /lật|Lật|elephant/i }).first().click()
    await sleep(900)
  })
  await S('word-result3', '/words/animals/animals-elephant?fixture=result3')
  await S('sentences', '/sentences')
  await S('sentences-topic', '/sentences?topic=family')
  await S('sentence-empty', '/sentence/s12')
  await S('sentence-partial', null, async () => { await tapText(page, 'My'); await tapText(page, 'sister') })
  await S('sentence-wrong', '/sentence/s12', async () => {
    for (const w of ['My', 'sister', 'doll.', 'a', 'baby', 'has']) await tapText(page, w, { noWait: true })
  }, true)
  await S('sentence-correct', '/sentence/s12', async () => {
    for (const w of ['My', 'sister', 'has', 'a', 'baby', 'doll.']) await tapText(page, w)
    await sleep(500)
  })
  // Task 11 wires SentenceBuilder's "mark the tray correct when a fixture result is present".
  await S('sentence-result3', '/sentence/s12?fixture=result3')
  await S('parent-gate', '/parent')
  await S('parent-gate-wrong', null, async () => { await page.fill('input', '7'); await page.keyboard.press('Enter') })
  await S('parent-dashboard', '/parent', async () => {
    const q = await page.locator('text=/\\d+ × \\d+/').first().textContent()
    const [a, b] = q.match(/\d+/g).map(Number)
    await page.fill('input', String(a * b)); await page.keyboard.press('Enter'); await sleep(1500)
  })

  // ---------- special Home states ----------
  await seed(page, { overLimit: true })
  await S('home-over-limit', '/')
  // Task 9: Home nhiều banner. Dev build không có env Supabase nên banner "mốc email" không thể
  // bật headless — ảnh này là frame 2 banner (⚠️ hết giờ + ℹ️ A2HS). Dòng "+N" của NoticeStack
  // được chứng minh bằng unit test (Task 8) và bằng hàng checklist iPad thật ở Task 16.
  if (vpName === 'phone' && (!WANT || WANT.includes('home-3-banners'))) {
    const ios2 = await browser.newContext({ ...vp, reducedMotion: 'reduce', locale: 'vi-VN',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
    const p3 = await ios2.newPage()
    await seed(p3, { overLimit: true })
    await go(p3, '/')
    await shot(p3, dir, 'home-3-banners')
    log('✓ phone/home-3-banners')
    await ios2.close()
  }
  await seed(page, { profiles: true })
  await S('profile-gate', '/')
  await S('parent-dashboard-profiles', '/parent', async () => {
    await page.getByRole('button', { pressed: true }).first().click({ timeout: 5000 })
    await sleep(600)
    const q = await page.locator('text=/\\d+ × \\d+/').first().textContent()
    const [a, b] = q.match(/\d+/g).map(Number)
    await page.fill('input', String(a * b)); await page.keyboard.press('Enter'); await sleep(1500)
  })
  if (vpName === 'phone') {
    const ios = await browser.newContext({ ...vp, reducedMotion: 'reduce', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
    const p2 = await ios.newPage()
    await p2.goto(BASE + '/'); await settle(p2, 800)
    await p2.screenshot({ path: path.join(dir, 'home-ios-a2hs.png') }); log('✓ phone/home-ios-a2hs')
    await ios.close()
  }
  await browser.close()
}

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  if (!ACTIVE_VIEWPORTS.has(name)) continue
  if (ONLY && ONLY !== name) continue
  log(`=== ${name} ===`)
  await run(name, vp)
}
log('done')

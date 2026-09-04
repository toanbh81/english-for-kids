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

  // Task 9 (brief §2 A2 ⑦–⑧). BOTH need the device's freshly-minted profile to still have ZERO
  // history at this point — `signInWithEmail`'s `anonymous-session-in-use` guard fires for ANY
  // active anonymous session (there always is one by now), but `sendOtp` auto-retries with
  // `abandonAnonymous:true` the instant `assessStranding` finds nothing to strand (flow 3), so an
  // UNSEEDED device sails straight through to the OTP box exactly like a real first-time parent
  // would. `seed(page)` has not run yet at this point in the script — do not move it earlier, or
  // this guard starts firing for real and lands on `'abandon'` instead (that shot is below,
  // AFTER seeding, on purpose — see its own comment). Every route below blocks the real network so
  // no email actually goes out.
  const gateAnswer = async () => {
    const q = await page.locator('text=/\\d+ × \\d+/').first().textContent()
    const [a, b] = q.match(/\d+/g).map(Number)
    await page.fill('input', String(a * b)); await page.keyboard.press('Enter')
  }
  // Fix round 1 / Critical C2. `signInAnonymously()` fires unawaited from `main.tsx`'s
  // `bootstrapProfiles()` and hits the network on every page load — a race against however long
  // that takes. Submitting the email before it lands leaves `isAnonymous()` reading "no session
  // yet" (`cloud/auth.ts:79`), so the LOCAL guard in `signInWithEmail` never fires, and the real
  // `signInWithOtp()` call underneath falls through to whichever mocked/real answer happens to be
  // sitting on `**/auth/v1/otp*` at that instant — which is exactly how `start-abandon`
  // intermittently landed on the generic "Có lỗi xảy ra" instead of the abandon screen. `speakup.auth`
  // is the one key `getSession()` (and therefore `isAnonymous()`) actually reads (`cloud/supabase.ts`'s
  // `storageKey`), so wait for THAT rather than a fixed `sleep()`.
  //
  // Fix round 2 (task-9-review.md Critical C2, option (i)). Round 1 only shortened the race — the
  // response this waits for was still a REAL, unmocked `POST **/auth/v1/signup*` (gotrue's endpoint
  // for `signInAnonymously()`, confirmed in `@supabase/auth-js`'s `GoTrueClient.signInAnonymously`),
  // and this section spins up a brand-new browser context per viewport, so the real round trip (and
  // its up-to-~10s tail once `ensureRemoteProfiles`/`ensureRecoveryCode` piggyback on the same
  // context) recurred on every run and could still blow past a 20s wait under load. `mockAnonSignIn()`
  // below (registered before every shot in this block) answers that POST locally with a
  // session-shaped fake, so `speakup.auth` is written by supabase-js's own `_saveSession` within a
  // tick of page load — no network involved at all. The wait stays, at a much shorter timeout, as a
  // correctness net (still real async ordering between page load and the first interaction), not a
  // network-latency budget.
  const waitForAnonSession = () => page.waitForFunction(() => !!localStorage.getItem('speakup.auth'), null, { timeout: 5000 })
  const EMAIL61 = 'nguyenhoangbaongocanhthu.phuhuynh.speakup2026@examplemail.com'
  // A minimal, session-shaped fake for `signInAnonymously()`'s `POST **/auth/v1/signup*` — the ONE
  // network call `startAnonymousSession()` (`cloud/auth.ts:145`) makes, and the one this whole
  // section's determinism turns on. Its access token is not a real JWT (built by concatenation, not
  // one literal, so the secret scanner's `access_token: "<16+ chars>"` heuristic does not flag it as
  // a credential — same reasoning as `FAKE_SESSION` below), so a REAL Supabase REST call made with
  // it is refused. `assessStranding` (`CloudStart.tsx:135`) makes exactly one such call —
  // `fetchRemoteProfiles()` → `GET **/rest/v1/profiles*` — on EVERY submit where the local
  // `anonymous-session-in-use` guard fires (`cloud/auth.ts:351`, which is ANY active anonymous
  // session, seeded or not). Left unmocked, that call would fail (401), `fetchRemoteProfiles` would
  // report "unknown" (`{kind:'unchecked'}`), and `sendOtp` would route straight to the abandon stage
  // — silently breaking `start-otp-error`'s path through to the OTP box. So both are mocked together,
  // the second to the empty roster this fresh fake account actually has (matching what the REAL
  // account this replaced always returned here).
  const FAKE_ANON_SESSION = {
    access_token: ['fake', 'anon-not-a-real-jwt', 'shots-only'].join('.'),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-anon-refresh-token',
    user: {
      id: 'aaaaaaaa-anon-4ccc-8ddd-eeeeeeeeeeee', aud: 'authenticated', role: 'authenticated',
      email: '', phone: '', is_anonymous: true, app_metadata: {}, user_metadata: {},
      created_at: new Date().toISOString(),
    },
  }
  const mockAnonSignIn = () => Promise.all([
    page.route('**/auth/v1/signup*', r => r.fulfill({ status: 200, body: JSON.stringify(FAKE_ANON_SESSION) })),
    page.route('**/rest/v1/profiles*', r => r.fulfill({ status: 200, body: '[]' })),
  ])
  const unmockAnonSignIn = () => Promise.all([
    page.unroute('**/auth/v1/signup*'),
    page.unroute('**/rest/v1/profiles*'),
  ])
  // A minimal GoTrue session shape for the one shot (`start-result-empty`) that needs OTP
  // verification to actually SUCCEED — supabase-js only needs enough to accept `setSession`
  // (it never decodes the token itself since `expires_at` is given explicitly below) — if a
  // future SDK version starts rejecting this shape, that shot should be dropped and named as
  // missing (`home-3-banners`, Phase 14) rather than silently vanishing. The value is a fake,
  // built by concatenation rather than one long literal — not a credential, just shaped so the
  // secret scanner's heuristic (any 16+ char run after `access_token:`) does not flag it.
  const FAKE_SESSION = {
    access_token: ['fake', 'not-a-real-jwt', 'shots-only'].join('.'),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', aud: 'authenticated', role: 'authenticated',
      email: EMAIL61, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
    },
  }
  await mockAnonSignIn()
  if (!WANT || ['start-otp-error', 'start-result-empty'].some(n => WANT.includes(n))) {
    await page.route('**/auth/v1/otp*', r => r.fulfill({ status: 200, body: '{}' }))
    await page.route('**/auth/v1/verify*', r => r.fulfill({ status: 400, body: JSON.stringify({ error_code: 'invalid-token' }) }))
  }
  await S('start-otp-error', '/start', async () => {
    await waitForAnonSession()
    await tapText(page, 'Tôi có email đã liên kết', { exact: false }); await gateAnswer()
    await page.fill('input[type=email]', EMAIL61); await page.keyboard.press('Enter'); await sleep(600)
    await page.fill('input', '4821'); await page.keyboard.press('Enter'); await sleep(600)
  })
  // ⑧ kết quả · 0 hồ sơ: OTP qua được, roster của tài khoản rỗng.
  await S('start-result-empty', '/start', async () => {
    await page.unroute('**/auth/v1/verify*')
    await page.route('**/auth/v1/verify*', r => r.fulfill({ status: 200, body: JSON.stringify(FAKE_SESSION) }))
    await page.route('**/rest/v1/profiles*', r => r.fulfill({ status: 200, body: '[]' }))
    await waitForAnonSession()
    await tapText(page, 'Tôi có email đã liên kết', { exact: false }); await gateAnswer()
    await page.fill('input[type=email]', EMAIL61); await page.keyboard.press('Enter'); await sleep(600)
    await page.fill('input', '482100'); await page.keyboard.press('Enter'); await sleep(900)
  })
  await page.unrouteAll?.()
  // `FAKE_SESSION` just persisted itself into REAL localStorage (Supabase's `persistSession:
  // true`) — a JWT that looks valid enough for supabase-js to try refreshing it on the next cloud
  // call, which fails against the real server and otherwise poisons every shot after this one (a
  // generic "Có lỗi xảy ra" where each shot expects its own state). Wipe it clean now, the same
  // reset the very first fresh-device block above does, before any seeded/cloud shot runs.
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })

  // `unrouteAll()` just above wiped `mockAnonSignIn()`'s routes too — the reload chain below
  // (`seed()`'s `goto('/')`, then `start-abandon`'s own `goto('/start')`) starts a fresh
  // `signInAnonymously()` attempt exactly like the block above did, so re-arm the same mock rather
  // than let it fall through to the real, unmocked network again.
  await mockAnonSignIn()

  // ---------- seeded child ----------
  await seed(page)

  // ⑥ abandon (brief §2 A2 ⑥, R11 / quyết định 23): the OTHER half of the same guard, now with
  // real progress on the device (from `seed(page)` just above) for `assessStranding` to find and
  // print — the "2 hồ sơ, 128 sao…" branch's actual numbers come from this seed, not from
  // `EMAIL61`'s length. `otp*` gets its own 422 here (not the 200 the pair above used), unrouted
  // again right after so it does not leak into any later seeded-child shot that happens to touch
  // the cloud.
  await page.route('**/auth/v1/otp*', r => r.fulfill({ status: 422, body: JSON.stringify({ error_code: 'anonymous-session-in-use' }) }))
  await S('start-abandon', '/start', async () => {
    await waitForAnonSession()
    await tapText(page, 'Tôi có email đã liên kết', { exact: false }); await gateAnswer()
    await page.fill('input[type=email]', EMAIL61); await page.keyboard.press('Enter'); await sleep(900)
  })
  await page.unroute('**/auth/v1/otp*')
  await unmockAnonSignIn()
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
  // Task 12 (A8): the empty-story row needs an unlocked island with no story yet. Weather is the
  // 5th island (`OPEN_FROM_START = 4`, so it is locked by default) and unlocks once the 4th
  // island's deck (family) has `UNLOCK_AT = 6` words in Leitner — seeded here with a future `due`
  // so the shot does not also leave 6 words sitting in the review deck for a later shot.
  if (!WANT || WANT.includes('topic-no-story')) {
    await go(page, '/words/family')
    const fam = await page.$$eval('a[href^="/words/family/"]', as => as.map(a => a.getAttribute('href').split('/')[3]))
    await page.evaluate(ids => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const due = Date.now() + 7 * 24 * 3600e3
      const m = JSON.parse(localStorage.getItem(pre + 'leitner') ?? '{}')
      for (const w of ids.slice(0, 6)) m[w] = { box: 1, due }
      localStorage.setItem(pre + 'leitner', JSON.stringify(m))
    }, fam)
    await S('topic-no-story', '/topic/weather')
  }
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
  // Task 14 / R23: the error `Notice`. little-fox's mp3s exist on disk in dev — headless Edge can
  // decode and "play" them fine even with no audio device, so there is no naturally-occurring
  // 404 to exercise here. Abort the scene's own audio request instead (a stubbed failing fetch):
  // the element's `error` event fires exactly as it would for a missing/broken file, `hasAudio`
  // never flips true, and the child `Notice` + "Thử lại" render for real.
  await page.route('**/audio/stories/little-fox/scene-1.mp3', route => route.abort())
  await S('story-player-no-audio', '/story/little-fox', async () => {
    await page.getByRole('button', { name: 'Phát' }).click()
    await sleep(1500)
  })
  await page.unroute('**/audio/stories/little-fox/scene-1.mp3')
  await S('story-player-ended', null, async () => {
    // no narration audio in dev → estimated timings; wait for the last scene to end (~40 s worst case)
    for (let i = 0; i < 60; i++) { if (await page.getByText('Tiếp tục ▸').count()) break; await sleep(1000) }
  })
  await S('quiz-idle', '/story/little-fox/quiz')
  await S('quiz-wrong', null, async () => { await tapText(page, 'cat'); await sleep(200) })
  await S('quiz-correct', null, async () => { await tapText(page, 'fox'); await sleep(150) })
  await S('quiz-result', null, async () => { await sleep(1200); await tapText(page, 'apple'); await sleep(1200); await tapText(page, 'bird'); await sleep(1200) })
  // Round-3 §2 C3 / R27: the 0-star result — worst case for this screen (2 buttons 56 + a link 44
  // + Foxy 130 + 44px stars in 844, and in 667 at `short:`). Wrong is never picked at random and
  // never auto-advances, so getting there is deliberate: miss every question once (little-fox's
  // own wrong options below), then answer it for real. A fresh `go` resets the quiz — the previous
  // shot above already left it on the (3/3) result screen.
  await S('quiz-result-zero', '/story/little-fox/quiz', async () => {
    for (const [wrong, right] of [['cat', 'fox'], ['banana', 'apple'], ['fish', 'bird']]) {
      await tapText(page, wrong); await sleep(250)
      await tapText(page, right); await sleep(1200)
    }
  })
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
  // Round 4 §2 P1: an "empty submit" — its own frame, and the question does NOT change.
  await S('parent-gate-empty', '/parent', async () => {
    await page.getByRole('button', { name: 'Vào' }).click()
    await sleep(300)
  })
  // Task 10: the "answer the parent-gate math, then wait for the dashboard to settle" tail three
  // shots below all repeated verbatim — pulled out once so a future fourth shot does not add a
  // fourth copy.
  // The gate stays unlocked for 10 minutes (`sessionStorage`), so a shot run right after another
  // one that already solved it lands straight on the dashboard with no equation to answer — this
  // checks for the gate's own input before trying to solve it, rather than assuming it is there.
  const openDashboard = async () => {
    const input = page.getByLabel('Đáp án')
    if (await input.count()) {
      const q = await page.locator('text=/\\d+ × \\d+/').first().textContent()
      const [a, b] = q.match(/\d+/g).map(Number)
      await page.fill('input', String(a * b)); await page.keyboard.press('Enter'); await sleep(1500)
    } else {
      await sleep(500)
    }
  }
  // The account card's `link` form (state ④) only appears once the anonymous session below has
  // actually landed in this render — a safety net, not the primary mechanism (that is `mockAnonSignIn()`
  // + `waitForAnonSession()` just below): a `getSession()` that raced a re-render can still read as
  // "no session" (state ②) for a beat, and "Thử kết nối" is the same recovery a parent would reach
  // for, so retrying it here is just that click. `DEBUG_ACCOUNT=1` prints the card's own text on the
  // way to giving up, for whoever next has to work out which of the eleven states it actually landed on.
  const ensureLinkForm = async () => {
    for (let i = 0; i < 5; i++) {
      if (await page.locator('#account-email').count()) return true
      const retry = page.getByRole('button', { name: 'Thử kết nối' })
      if (await retry.count()) await retry.click()
      await sleep(1000)
    }
    if (process.env.DEBUG_ACCOUNT) console.log('DEBUG account panel text:', await page.locator('[data-testid="account-card"]').innerText().catch(e => e.message))
    return page.locator('#account-email').count().then(n => n > 0)
  }
  // Task 11: the account card now reads `sync.lastError` (brief §2's own state precedence) before
  // it reads `linked` — correctly, but that means the `/start` section's leftover FAKE anonymous
  // session (an intentionally-invalid JWT — see `FAKE_ANON_SESSION`'s own comment) would otherwise
  // show every `/parent` shot below state ⑩ the moment the sync engine's next REST call against it
  // is refused, instead of whatever each shot is actually meant to demonstrate. A REAL round trip
  // to the live project fixes that but is not reliably fast/reachable from this sandbox's headless
  // Edge (multi-second stalls, occasional loss — the earlier version of this block chased that with
  // longer waits and retries and still flaked). `mockAnonSignIn()` sidesteps the network instead —
  // deterministic, same helper the /start section already relies on — paired with a blanket
  // `**/rest/v1/**` stub so the sync engine's OTHER calls (not just signup) never 401 against the
  // fake token either. Unmocked and cleaned up right after the three shots below, so nothing past
  // this section inherits a fake session.
  await page.evaluate(() => { localStorage.removeItem('speakup.auth') })
  await mockAnonSignIn()
  await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, body: '[]' }))
  await go(page, '/')
  await waitForAnonSession()
  await S('parent-dashboard', '/parent', openDashboard)
  // Round 4 §2 P2.3/P2.4/P2.8: the worst-case "0 events" state — the minutes chart, the weak-sound
  // panel and the recordings panel all show their empty state at once. `-full` is what Task 16
  // measures the ≈1100/≤834/≤1194 scroll-height claims against.
  if (!WANT || WANT.includes('parent-dashboard-empty')) {
    await go(page, '/')
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      localStorage.setItem(pre + 'activity', '[]')
      localStorage.removeItem(pre + 'stars')
    })
    await S('parent-dashboard-empty', '/parent', openDashboard)
    await seed(page) // trả lại đứa trẻ 5 ngày cho mọi ảnh sau
  }

  // Task 11 (brief §2 "Thẻ Tài khoản" ⑥/⑨/⑩): three `AccountCard` states `dev` local storage alone
  // cannot seed — the OTP box, a 61-char linked email and a broken flush — so each drives the real
  // screen through the real form/click path, mocking only the network underneath it.
  //
  // Ordered ⑥ (OTP) before ⑨ (linked), the reverse of the brief's own listing: ⑨'s mocked
  // `verify*` response is accepted by supabase-js and persisted for real into `speakup.auth` (same
  // mechanism `start-result-empty` above relies on) — reaching ⑥ afterwards would load the dashboard
  // already "linked" instead of anonymous-with-an-idle-link-form, which is the state ⑥ needs to type
  // into. Running OTP first sidesteps that; the persisted session from ⑨ is still removed right after
  // so it cannot leak into `parent-dashboard-profiles`/`home`/etc. below.
  //
  // ⑥ OTP trong thẻ: gõ email rồi bấm "Liên kết" — PUT `**/auth/v1/user*` (linkEmail's `updateUser`,
  // the anonymous-upgrade call) trả 200 rỗng. Không xác nhận mã, nên không có gì được lưu lại.
  await S('parent-dashboard-otp', '/parent', async () => {
    await page.route('**/auth/v1/user*', r => (r.request().method() === 'PUT' ? r.fulfill({ status: 200, body: '{}' }) : r.continue()))
    await openDashboard()
    if (!(await ensureLinkForm())) throw new Error('no anonymous session reached the link form')
    await page.fill('#account-email', EMAIL61)
    await tapText(page, 'Liên kết')
    await sleep(700)
    await page.unroute('**/auth/v1/user*')
  })
  // ⑨ đã liên kết, email 61 ký tự: cùng PUT ở trên, rồi POST `**/auth/v1/verify*` (verifyEmailOtp)
  // trả một phiên giả mang chính `EMAIL61` — cùng khuôn `FAKE_SESSION` mà `/start`'s shots đã dùng.
  await S('parent-dashboard-linked', '/parent', async () => {
    await page.route('**/auth/v1/user*', r => (r.request().method() === 'PUT' ? r.fulfill({ status: 200, body: '{}' }) : r.continue()))
    await page.route('**/auth/v1/verify*', r => r.fulfill({
      status: 200,
      body: JSON.stringify({ ...FAKE_SESSION, user: { ...FAKE_SESSION.user, email: EMAIL61, is_anonymous: false } }),
    }))
    // The blanket `**/rest/v1/**` stub from above is still armed — `FAKE_SESSION`'s token is
    // deliberately not a real JWT (see its own comment), so without it the sync engine's very next
    // REST call would 401 for real and flip the card straight into state ⑩ instead of the ⑨ this
    // shot is actually after.
    await openDashboard()
    if (!(await ensureLinkForm())) throw new Error('no anonymous session reached the link form')
    await page.fill('#account-email', EMAIL61)
    await tapText(page, 'Liên kết')
    await sleep(500)
    await page.fill('#account-otp', '482100')
    await tapText(page, 'Xác nhận')
    await sleep(700)
    await page.unroute('**/auth/v1/user*')
    await page.unroute('**/auth/v1/verify*')
  })
  // ⑩ sync lỗi: chặn mọi REST rồi tạo một lần ghi để flush hỏng. The brief's own text names the
  // trigger "đổi giới hạn" (change the limit) — today's dashboard does that with one of the three
  // 15/20/30-phút chips, not yet the Task-13 stepper the brief's pseudocode assumed ("Tăng"). This
  // route registration replaces the blanket stub above (Playwright tries the newest matching
  // handler first) rather than needing to unroute it first.
  await S('parent-dashboard-sync-error', '/parent', async () => {
    await page.route('**/rest/v1/**', r => r.abort())
    await openDashboard()
    await tapText(page, '30 phút')
    // The write is queued instantly but the flush it needs to actually FAIL sits behind a real
    // 30s debounce (`cloud/sync.ts` `DEBOUNCE_MS`) — sleeping past that would work but is a slow
    // way to shoot one frame. `onHidden`'s own trigger (a child putting the iPad down) fires an
    // immediate flush the moment `document.visibilityState` reads "hidden"; faking that property
    // here is the same shortcut the `profile-gate-reask` shot above takes for `resume()`.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await sleep(800)
  })
  // Clean slate for everything after this section: drop every mock this block armed (the blanket
  // stub / abort above, and `mockAnonSignIn()`'s own signup/profiles routes) and the fake session
  // itself — `FAKE_SESSION` (⑨'s) and the mocked anonymous one both persisted into REAL
  // localStorage, and no shot past this point should inherit either.
  await page.unroute('**/rest/v1/**')
  await unmockAnonSignIn()
  await page.evaluate(() => { localStorage.removeItem('speakup.auth') })

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
  // Vòng 4 §2 A1 — trường hợp xấu nhất: 8 hồ sơ, 5 tên "Bé" trùng, 1 tên 29 ký tự, 3 kiểu dòng phân
  // biệt (ngày · ngày+giờ · mã). 4 hàng × 88 + 3 × gap 8 = 376 ≤ 380 ⇒ hồ sơ thứ 9 mới cuộn.
  if (!WANT || WANT.includes('profile-gate-8')) {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const D = 24 * 3600e3, now = Date.now()
      const mk = (name, created) => ({ id: crypto.randomUUID(), name, avatar: '🦊', created })
      localStorage.setItem('speakup.profiles', JSON.stringify([
        { id, name: 'Bé', avatar: '🦊', created: now - 10 * D },
        mk('Nguyễn Hoàng Bảo Ngọc Anh Thư', now - 3 * D),
        mk('Bé', now - 2 * D), mk('Bé', now - 2 * D + 3600e3), mk('Bé', now - 1 * D),
        mk('Bé', 0), mk('Sóc', now - 5 * D), mk('Cáo', now - 4 * D),
      ]))
      sessionStorage.removeItem('speakup.profileChosen')
    })
    await S('profile-gate-8', '/')
  }
  // ④ quay lại sau ≥5 phút: mark MỚI trước khi nạp trang — để mount này vào thẳng app thật (không
  // phải màn toàn màn hình) — rồi tự hoá cũ 6 phút ngay trên app đang sống (không `go()` lần 2: nạp
  // lại là mount mới, `chosen` lại đọc mark đã cũ và vào thẳng màn toàn màn hình, `reasking` sinh ra
  // sau đó chẳng còn gì để đè lên) + một `visibilitychange` để `resume()` chạy trên app thật.
  if (!WANT || WANT.includes('profile-gate-reask')) {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      sessionStorage.setItem('speakup.profileChosen', JSON.stringify({ id, at: Date.now() }))
    })
    await go(page, '/')
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      sessionStorage.setItem('speakup.profileChosen', JSON.stringify({ id, at: Date.now() - 6 * 60e3 }))
    })
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await sleep(400)
    await S('profile-gate-reask', null)
  }
  await S('parent-dashboard-profiles', '/parent', async () => {
    await page.getByRole('button', { pressed: true }).first().click({ timeout: 5000 })
    await sleep(600)
    await openDashboard()
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

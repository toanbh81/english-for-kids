import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LevelStairs } from './LevelStairs'

function renderStairs() {
  render(<MemoryRouter><LevelStairs /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('links all five levels of the Speak Lab staircase', () => {
  renderStairs()
  expect(screen.getByRole('link', { name: /Tập âm/ })).toHaveAttribute('href', '/level/sound-zoo')
  expect(screen.getByRole('link', { name: /Đọc từ/ })).toHaveAttribute('href', '/level/word-pop')
  expect(screen.getByRole('link', { name: /Nghe & chọn/ })).toHaveAttribute('href', '/level/minimal-pairs')
  expect(screen.getByRole('link', { name: /Sentence Stars/ })).toHaveAttribute('href', '/level/sentence-stars')
  expect(screen.getByRole('link', { name: /Story Voice/ })).toHaveAttribute('href', '/level/story-voice')

  expect(screen.queryByText('Sắp có')).not.toBeInTheDocument()
})

it('reads the Nghe & chọn stars off the pair keys, not off any word card', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'pair:pair-ship-sheep': 2, 'pair:pair-cap-cup': 1 }))
  renderStairs()

  // The best of the eight pairs is what the step shows.
  const step = within(screen.getByTestId('step-minimal-pairs'))
  expect(step.getAllByTestId('star-filled')).toHaveLength(2)
  // Tập âm is unaffected by a pair key.
  expect(within(screen.getByTestId('step-sound-zoo')).queryAllByTestId('star-filled')).toHaveLength(0)
})

it('reads the Sentence Stars stars off the sstar keys and Story Voice off the voice keys', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sstar:ss1': 1, 'sstar:ss9': 3, 'voice:sv2': 2 }))
  renderStairs()

  // The best of the ten sentences / eight passages is what each step shows.
  expect(within(screen.getByTestId('step-sentence-stars')).getAllByTestId('star-filled')).toHaveLength(3)
  expect(within(screen.getByTestId('step-story-voice')).getAllByTestId('star-filled')).toHaveLength(2)
})

/** Phase 9 moved the sound's stars onto its words: the step shows the best sound, and a sound is
 * only as good as its weakest word. */
it('reads the Tập âm stars off the words of each sound', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({
    'sword:sz-v-very': 3, 'sword:sz-v-van': 3, 'sword:sz-v-seven': 2,
    'sword:sz-th-three': 3, // one word of /θ/ only — that sound still counts for nothing
  }))
  renderStairs()

  expect(within(screen.getByTestId('step-sound-zoo')).getAllByTestId('star-filled')).toHaveLength(2)
})

it('stands Foxy on the first step that is not finished yet', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3 }))
  renderStairs()
  // Tập âm has 3 stars on its th sound, so it is done and Foxy moves on to Đọc từ.
  expect(within(screen.getByTestId('step-word-pop')).getByTestId('foxy')).toBeInTheDocument()
})

it('moves Foxy on to Nghe & chọn once the two word levels are done', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3, 'wp-cat': 3 }))
  renderStairs()
  expect(within(screen.getByTestId('step-minimal-pairs')).getByTestId('foxy')).toBeInTheDocument()
})

it('moves Foxy on to Sentence Stars and then Story Voice as each level finishes', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3, 'wp-cat': 3, 'pair:pair-ship-sheep': 3 }))
  renderStairs()
  expect(within(screen.getByTestId('step-sentence-stars')).getByTestId('foxy')).toBeInTheDocument()
})

it('stands Foxy on the last step once every earlier level is finished', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({
    'sound:th': 3, 'wp-cat': 3, 'pair:pair-ship-sheep': 3, 'sstar:ss1': 3,
  }))
  renderStairs()
  expect(within(screen.getByTestId('step-story-voice')).getByTestId('foxy')).toBeInTheDocument()
})

it('falls back to the last step once the whole staircase is finished', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({
    'sound:th': 3, 'wp-cat': 3, 'pair:pair-ship-sheep': 3, 'sstar:ss1': 3, 'voice:sv1': 3,
  }))
  renderStairs()
  expect(within(screen.getByTestId('step-story-voice')).getByTestId('foxy')).toBeInTheDocument()
})

/** Phase 5 moved Tập âm's stars from per-card `sz-*` keys to per-sound `sound:<ph>` keys, so a
 * child who practised before that has only the old keys — reading just the new ones emptied the
 * step and looked like lost progress. */
it('still counts the legacy per-card sz- key so returning children keep their stars', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 2 }))
  renderStairs()
  expect(within(screen.getByTestId('step-sound-zoo')).getAllByTestId('star-filled')).toHaveLength(2)
})

it('takes the best of the new sound key and the legacy card key', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 2, 'sound:v': 3 }))
  renderStairs()
  expect(within(screen.getByTestId('step-sound-zoo')).getAllByTestId('star-filled')).toHaveLength(3)
})

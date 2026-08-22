import { parseAzureResult, pcmToWav } from './azureScorer'

it('parses NBest[0] into PronunciationResult', () => {
  const r = parseAzureResult({ NBest: [{
    PronunciationAssessment: { AccuracyScore: 85, FluencyScore: 90, CompletenessScore: 100, PronScore: 88, ProsodyScore: 70 },
    Words: [{ Word: 'three', PronunciationAssessment: { AccuracyScore: 40, ErrorType: 'Mispronunciation' },
      Phonemes: [{ Phoneme: 'th', PronunciationAssessment: { AccuracyScore: 20 } }] }],
  }] })
  expect(r).toEqual({ overall: 88, accuracy: 85, fluency: 90, completeness: 100, prosody: 70, engine: 'azure',
    words: [{ word: 'three', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'th', score: 20 }] }] })
})
it('throws on missing NBest', () => { expect(() => parseAzureResult({})).toThrow() })

describe('pcmToWav', () => {
  const ascii = (v: DataView, off: number, len: number) =>
    Array.from({ length: len }, (_, i) => String.fromCharCode(v.getUint8(off + i))).join('')

  it('writes a mono 16-bit RIFF/WAVE header for the sample rate it is given', () => {
    const v = new DataView(pcmToWav(new Float32Array(4), 16000))
    expect(ascii(v, 0, 4)).toBe('RIFF')
    expect(ascii(v, 8, 4)).toBe('WAVE')
    expect(ascii(v, 12, 4)).toBe('fmt ')
    expect(ascii(v, 36, 4)).toBe('data')
    expect(v.getUint16(20, true)).toBe(1) // PCM
    expect(v.getUint16(22, true)).toBe(1) // mono
    expect(v.getUint16(32, true)).toBe(2) // block align
    expect(v.getUint16(34, true)).toBe(16) // bits per sample
  })

  it('stores the sample rate at byte 24 and the byte rate at byte 28 (little-endian)', () => {
    const at16k = new DataView(pcmToWav(new Float32Array(1), 16000))
    expect(at16k.getUint32(24, true)).toBe(16000)
    expect(at16k.getUint32(28, true)).toBe(32000)
    const at48k = new DataView(pcmToWav(new Float32Array(1), 48000))
    expect(at48k.getUint32(24, true)).toBe(48000)
    expect(at48k.getUint32(28, true)).toBe(96000)
  })

  it('sizes the buffer and the data chunk from the sample count', () => {
    const buf = pcmToWav(new Float32Array(10), 16000)
    expect(buf.byteLength).toBe(44 + 20)
    const v = new DataView(buf)
    expect(v.getUint32(40, true)).toBe(20) // data length = samples * 2
    expect(v.getUint32(4, true)).toBe(36 + 20) // RIFF chunk size
  })

  it('clamps samples outside ±1 instead of wrapping', () => {
    const v = new DataView(pcmToWav(new Float32Array([2, -2, 0]), 16000))
    expect(v.getInt16(44, true)).toBe(0x7fff)
    expect(v.getInt16(46, true)).toBe(-0x7fff)
    expect(v.getInt16(48, true)).toBe(0)
  })
})

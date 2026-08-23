"""Prosody metrics for comparing narration clips (pitch register/range/movement, loudness dynamics).

Usage (Python 3.11 with praat-parselmouth + numpy):
  python scripts/analyze-prosody.py samples/reference.wav client/public/audio/stories/little-fox/scene-4.mp3
Targets from a reference children's-story video (samples/rambutan.mp4, 2026-08-23):
  f0_mean≈214 Hz, f0_range_st≈19, f0_sd_st≈6, int_sd≈23, ~130 wpm, 350–500 ms sentence pauses,
  key nouns stretched to 700–1100 ms.
"""
import sys
import numpy as np
import parselmouth


def analyze(path: str) -> dict:
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    f0 = pitch.selected_array['frequency']
    f0 = f0[f0 > 0]
    st = 12 * np.log2(f0 / 100.0)
    it = snd.to_intensity().values[0]
    it = it[it > 0]
    return dict(
        dur=snd.get_total_duration(),
        f0_mean=float(f0.mean()),
        f0_range_st=float(12 * np.log2(np.percentile(f0, 95) / np.percentile(f0, 5))),
        f0_sd_st=float(st.std()),
        move_st_per_s=float(np.abs(np.diff(st)).mean() * 100),
        int_sd=float(it.std()),
        int_range=float(np.percentile(it, 95) - np.percentile(it, 5)),
    )


if __name__ == '__main__':
    for p in sys.argv[1:]:
        r = analyze(p)
        print(p.split('/')[-1].ljust(28), ' '.join(f"{k}={v:.1f}" for k, v in r.items()))

# Claude Design handoff (2026-08-23)

Source project: https://claude.ai/design/p/9c792842-beb0-4158-a5d7-a3ac91730d3c

- `speak-up-prototype.dc.html` — interactive prototype of the core flow on an iPad 1194×834 frame: Home (island map), Daily Mission, Listening Player, Listening Quiz, Speak Lab card (ready / recording / result), Mission Complete, toast. Contains the Foxy SVG mascot (`fox()` with moods idle/listen/happy/cheer/wow) and the confetti generator.
- `speak-up-screens.dc.html` — static frames for the remaining screens and the component sheet.
- The `.dc.html` files need the Claude Design runtime (`support.js`, `image-slot.js`) to render; they are kept here only as the visual/token reference for the app's Tailwind implementation.

## Design tokens extracted
- Background page `#FFF7EA` (frame), canvas `#EFE5D6`; ink `#4A3B33`; muted `#8A7A6D`; faint `#B0A18E`; card shadow `0 8px 0 #EFE2CC` (hard offset, no blur).
- Coral `#FF7A59` (button) / `#F2603D` (accent text) / pressed `#E05A3A`; teal `#2EC4B6` / dark `#1FA396` / soft `#E2F6F1`; star yellow `#FFC533` / soft `#FFF1C9` / text `#9A6B00`; good `#2E8B4A` on `#E3F6E8` border `#7ED99A`; ok `#9A6B00` on `#FFF3D6` border `#FFD97E`; fix `#C2354B` on `#FFE3E6` border `#F8A3AE`.
- Fonts: headings/buttons **Baloo 2** 700–800; body **Nunito** 600–800. Radii 20–32 px; buttons `box-shadow: 0 6px 0 <darker>` with `translateY(2px)` on press.
- Animations: `pulse`, `ring` (recording), `fall` (confetti), `starDrop`, `bob` (Foxy), `wiggle` (mouth).

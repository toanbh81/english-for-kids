/**
 * The label of every control that walks back to `/`.
 *
 * Spec decision 3 (round 3): Home is only a map on iPad landscape — that is where the island grid
 * actually renders. Phone AND iPad portrait show the same plain "back to the home screen" wording,
 * so a CTA promising the map would be a lie there. The wording follows the `ipad:` breakpoint
 * rather than a device check — two spans, one of which is hidden — so only iPad landscape keeps
 * the map wording.
 *
 * It lives here because three screens print it (`DailyMission`, `MissionComplete`, `StoryQuiz`) and
 * a fourth wording would be a fourth thing to keep in step. `BackButton`'s `mdLabel` is the same
 * rule for a control whose label is never visible.
 */
export function HomeLabel() {
  return (
    <>
      <span className="ipad:hidden">Về trang chủ 🏠</span>
      <span className="hidden ipad:inline">Về bản đồ 🏝️</span>
    </>
  )
}

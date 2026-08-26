/**
 * The label of every control that walks back to `/`.
 *
 * Spec decision 1: the island map does not exist on a phone (Home drops it below the tablet
 * breakpoint), so a CTA promising to go back to it would be a lie there. The wording follows the
 * breakpoint rather than the device — two spans, one of which is hidden — so the tablet and the
 * iPad keep the map wording they have always had.
 *
 * It lives here because three screens print it (`DailyMission`, `MissionComplete`, `StoryQuiz`) and
 * a fourth wording would be a fourth thing to keep in step. `BackButton`'s `mdLabel` is the same
 * rule for a control whose label is never visible.
 */
export function HomeLabel() {
  return (
    <>
      <span className="md:hidden">Về trang chủ 🏠</span>
      <span className="hidden md:inline">Về bản đồ 🏝️</span>
    </>
  )
}

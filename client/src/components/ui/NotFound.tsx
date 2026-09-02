import { Foxy } from '../Foxy'
import { Button } from './Button'
import { PageShell, PageBody } from './page'

/** The one "this doesn't exist" screen every route lands on instead of a bare `<p>` — surprised
 * Foxy, a named reason and a way home (brief §2.6). `what` is the Vietnamese noun for the thing
 * that was not found ("thẻ", "âm", "truyện", …); `to` defaults to the map. */
export function NotFound({ what, to = '/' }: { what: string; to?: string }) {
  return (
    <PageShell>
      <PageBody center className="items-center gap-3 text-center">
        <div className="h-[93px] w-[96px]"><Foxy mood="surprised" size="md" /></div>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900">Ơ, không tìm thấy {what} này 🦊</h1>
        <p className="text-[14px] font-bold text-ink-500">Có thể đường dẫn bị lỗi. Về nhà rồi chọn lại nhé.</p>
        <Button variant="secondary" to={to} className="mt-1.5">← Về trang chủ</Button>
      </PageBody>
    </PageShell>
  )
}

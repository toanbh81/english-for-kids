import { STORY_VOICE } from '../content'
import { getStars } from '../progress/store'
import { BackButton, ListGrid, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** The first sentence is enough to recognise a passage by, and keeps every card the same height. */
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0] ?? text

/** Story Voice is the top bậc of the Speak Lab stairs: each card is a short passage to read with
 * a feeling, shown by its mood emoji. Stars live on `voice:<id>`. */
export function VoiceLevel() {
  return (
    <PageShell>
      <PageHeader
        back={<BackButton to="/levels" label="Các bậc" />}
        title="Story Voice 🎭"
        sub="Đọc có hồn — vui, buồn, ngạc nhiên!"
      />
      <PageBody fade gap={10}>
        <ListGrid size="lg">
          {STORY_VOICE.map((v, i) => (
            <Tile
              key={v.id}
              size="lg"
              titleSize={15}
              emoji={v.emoji}
              chip={{ tone: 'coral', label: v.moodVi }}
              title={firstSentence(v.text)}
              stars={getStars(`voice:${v.id}`)}
              ariaLabel={`Đoạn ${i + 1}: ${v.moodVi}`}
              to={`/voice/${v.id}`}
            />
          ))}
        </ListGrid>
      </PageBody>
    </PageShell>
  )
}

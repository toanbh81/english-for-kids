import { useParams } from 'react-router-dom'
import { LEVELS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, ListGrid, NotFound, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { SoundLevel } from './SoundLevel'

export function LevelSelect() {
  const { levelId } = useParams()
  // Tập âm is taught by sound, so `/level/sound-zoo` shows the 9 sound tiles instead of the
  // 27 word cards. Every other level keeps the card grid below.
  if (levelId === 'sound-zoo') return <SoundLevel />
  const level = LEVELS.find(l => l.id === levelId)
  if (!level) return <NotFound what="bậc" />
  return (
    <PageShell>
      {/* Back goes to the stairs, the entry point every level was reached from. */}
      <PageHeader
        back={<BackButton to="/levels" label="Các bậc" />}
        title={level.title}
        sub="Chạm vào một thẻ để luyện nói nhé!"
      />
      <PageBody fade gap={10}>
        <ListGrid size="sm">
          {level.cards.map(c => (
            <Tile
              key={c.id}
              to={`/practice/${c.id}`}
              emoji={c.emoji}
              title={c.text}
              stars={getStars(c.id)}
            />
          ))}
        </ListGrid>
      </PageBody>
    </PageShell>
  )
}

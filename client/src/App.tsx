import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './screens/Home'
import { LevelSelect } from './screens/LevelSelect'
import { PracticeCard } from './screens/PracticeCard'
import { StoryList } from './screens/StoryList'
import { StoryPlayer } from './screens/StoryPlayer'
import { StoryQuiz } from './screens/StoryQuiz'
import { StoryRetell } from './screens/StoryRetell'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/level/:levelId" element={<LevelSelect />} />
      <Route path="/practice/:cardId" element={<PracticeCard />} />
      <Route path="/stories" element={<StoryList />} />
      <Route path="/story/:id" element={<StoryPlayer />} />
      <Route path="/story/:id/quiz" element={<StoryQuiz />} />
      <Route path="/story/:id/retell" element={<StoryRetell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

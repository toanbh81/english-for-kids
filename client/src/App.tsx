import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './screens/Home'
import { LevelSelect } from './screens/LevelSelect'
import { PracticeCard } from './screens/PracticeCard'
import { StoryList } from './screens/StoryList'
import { StoryPlayer } from './screens/StoryPlayer'
import { StoryQuiz } from './screens/StoryQuiz'
import { StoryRetell } from './screens/StoryRetell'
import { WordTopics } from './screens/WordTopics'
import { WordList } from './screens/WordList'
import { WordCard } from './screens/WordCard'
import { SentenceList } from './screens/SentenceList'
import { SentenceBuilder } from './screens/SentenceBuilder'
import { ParentGate } from './screens/ParentGate'

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
      <Route path="/words" element={<WordTopics />} />
      <Route path="/words/:topic" element={<WordList />} />
      <Route path="/words/:topic/:wordId" element={<WordCard />} />
      <Route path="/sentences" element={<SentenceList />} />
      <Route path="/sentence/:id" element={<SentenceBuilder />} />
      <Route path="/parent" element={<ParentGate />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

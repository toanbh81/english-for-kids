import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './screens/Home'
import { DailyMission } from './screens/DailyMission'
import { MissionComplete } from './screens/MissionComplete'
import { LevelStairs } from './screens/LevelStairs'
import { LevelSelect } from './screens/LevelSelect'
import { PracticeCard } from './screens/PracticeCard'
import { SoundWordList } from './screens/SoundWordList'
import { SoundPractice } from './screens/SoundPractice'
import { PairLevel } from './screens/PairLevel'
import { PairPractice } from './screens/PairPractice'
import { StarLevel } from './screens/StarLevel'
import { StarPractice } from './screens/StarPractice'
import { VoiceLevel } from './screens/VoiceLevel'
import { VoicePractice } from './screens/VoicePractice'
import { StoryList } from './screens/StoryList'
import { StoryPlayer } from './screens/StoryPlayer'
import { StoryQuiz } from './screens/StoryQuiz'
import { StoryRetell } from './screens/StoryRetell'
import { WordTopics } from './screens/WordTopics'
import { WordList } from './screens/WordList'
import { WordCard } from './screens/WordCard'
import { SentenceList } from './screens/SentenceList'
import { SentenceBuilder } from './screens/SentenceBuilder'
import { TopicHub } from './screens/TopicHub'
import { ParentGate } from './screens/ParentGate'
import { CloudStart } from './screens/CloudStart'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/mission" element={<DailyMission />} />
      <Route path="/mission/done" element={<MissionComplete />} />
      <Route path="/topic/:id" element={<TopicHub />} />
      <Route path="/levels" element={<LevelStairs />} />
      {/* Static before dynamic: Minimal Pairs, Sentence Stars and Story Voice are bậc of their
        * own, not card levels. */}
      <Route path="/level/minimal-pairs" element={<PairLevel />} />
      <Route path="/level/sentence-stars" element={<StarLevel />} />
      <Route path="/level/story-voice" element={<VoiceLevel />} />
      <Route path="/level/:levelId" element={<LevelSelect />} />
      <Route path="/practice/:cardId" element={<PracticeCard />} />
      {/* A sound is a list of its words; one word is the drill. An old stored lesson still
        * pointing at `/sound/<ph>` lands on the list, which is a fine place to be. */}
      <Route path="/sound/:ph" element={<SoundWordList />} />
      <Route path="/sound/:ph/:cardId" element={<SoundPractice />} />
      <Route path="/pair/:id" element={<PairPractice />} />
      <Route path="/star/:id" element={<StarPractice />} />
      <Route path="/voice/:id" element={<VoicePractice />} />
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
      {/* The route is open; the DOORS behind it are not. `/start` is only ever linked from a
        * device with no history at all, but a typed URL still lands here, so the math question
        * sits in front of both actions — the one that can sign this iPad into another account
        * and the one that re-parents profiles onto it. Reading the two-button menu is harmless
        * (spec flows 3, 4). */}
      <Route path="/start" element={<CloudStart />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

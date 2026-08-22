import littleFox from './little-fox.json'
import atTheZoo from './at-the-zoo.json'
import myBreakfast from './my-breakfast.json'
import type { Story } from './types'

export const STORIES: Story[] = [littleFox as Story, atTheZoo as Story, myBreakfast as Story]
export const findStory = (id: string): Story | undefined => STORIES.find(s => s.id === id)

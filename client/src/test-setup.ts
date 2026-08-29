import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// findBy*/waitFor default to 1s, which starved workers miss during a full parallel run (see
// vite.config.ts's testTimeout note). 5s changes nothing when the app is correct and unflakes
// the suite when the machine is busy.
configure({ asyncUtilTimeout: 5000 })

export const LEVEL_TITLES = [
  'Seedling',
  'Newcomer',
  'Explorer',
  'Apprentice',
  'Scholar',
  'Focused Scholar',
  'Expert',
  'Deep Thinker',
  'Elite Scholar',
  'Mentor',
  'Sage',
  'Master',
  'Luminary',
  'Grandmaster',
  'Legend'
]

export function getLevelTitle(level) {
  return LEVEL_TITLES[level - 1] || `Level ${level} Scholar`
}

export const XP_MILESTONES = [
  { label: 'Levels 1–3 · Newcomer', xp: 750, color: '#10b981' },
  { label: 'Levels 4–6 · Scholar', xp: 1500, color: '#6366f1' },
  { label: 'Levels 7–9 · Expert', xp: 2250, color: '#8b5cf6' },
  { label: 'Levels 10–12 · Master', xp: 3000, color: '#f59e0b' },
  { label: 'Levels 13–15 · Legend', xp: 3750, color: '#ec4899' }
]

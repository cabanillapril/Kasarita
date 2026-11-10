export const DEFAULT_SUBJECT_NAMES = [
  'Coding',
  'Study',
  'Database',
  'Networking',
  'Math',
  'Lab'
]

export function getSubjectColors(subjects) {
  return Object.fromEntries(subjects.map((subject, index) => {
    const hue = (index * 137.508) % 360
    return [
      subject,
      {
        color: `hsl(${hue} 78% 58%)`,
        gradient: `linear-gradient(135deg, hsl(${hue} 78% 48%), hsl(${(hue + 18) % 360} 78% 60%))`
      }
    ]
  }))
}

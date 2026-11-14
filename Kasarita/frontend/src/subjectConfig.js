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
    const baseHue = (index * 137.508) % 360
    const isSoftRed = baseHue < 34 || baseHue > 330
    const hue = isSoftRed ? (baseHue + 18) % 360 : baseHue
    const saturation = isSoftRed ? 62 : 78
    const lightness = isSoftRed ? 62 : 58

    return [
      subject,
      {
        color: `hsl(${hue} ${saturation}% ${lightness}%)`,
        gradient: `linear-gradient(135deg, hsl(${hue} ${saturation}% ${Math.max(42, lightness - 14)}%), hsl(${(hue + 18) % 360} ${saturation}% ${Math.min(74, lightness + 10)}%))`
      }
    ]
  }))
}

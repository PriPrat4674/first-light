// The morning report card. A pure function: same morning in, same grade out.

const LETTERS = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'];
const LINES = {
  'A+': 'Flawless. The sun is honestly a little intimidated.',
  A: 'A clean rise, with only the faintest pillow negotiations.',
  'B+': 'Strong work. The snooze button noticed you, then thought better of it.',
  B: 'Respectable, if a touch theatrical.',
  C: 'The alarm had to fight for this one.',
  D: 'Technically awake. The paperwork is concerning.',
  F: 'A rescue mission more than a morning.'
};

export function grade(m) {
  if (!m || !m.doneAt) return null;
  const mins = Math.max(0, Math.round((m.doneAt - m.startedAt) / 60000));
  let penalty = (m.snoozes || 0) * 1 + (m.misses || 0) * 2;
  if (mins > 60) penalty += 2; else if (mins > 40) penalty += 1;
  const letter = LETTERS[Math.min(LETTERS.length - 1, penalty)];
  return { letter, line: LINES[letter], mins, snoozes: m.snoozes || 0, misses: m.misses || 0 };
}

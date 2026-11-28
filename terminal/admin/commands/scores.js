import { fetchTopScores, deleteScore, isStrayAuthed, whenAuthReady } from '../../../scripts/firebase-chat.js';

const GAME = 'larmor';

function list(rows) {
  if (!rows.length) return 'no scores yet.';
  return ['', ...rows.map((r) => `  ${r.id.padEnd(20)}  ${r.initials}  ${String(r.score).padStart(5, ' ')}`)].join('\n');
}

export default {
  name: 'scores',
  description: 'list arcade top 20 · scores rm <id> deletes one',
  // returns a promise: the terminal shows "scanning..." and prints the resolved string
  handler: async (args) => {
    const parts = String(args || '').trim().split(/\s+/).filter(Boolean);

    if (parts[0] === 'rm') {
      const want = (parts[1] || '').toLowerCase();
      if (!want) return 'usage: scores rm <id>';
      try {
        await whenAuthReady();
        if (!isStrayAuthed()) return 'not signed in. sign in from the transmit window first.';
        // the terminal lowercases arguments, so match the id case-insensitively
        const rows = await fetchTopScores(GAME, 100);
        const hit = rows.find((r) => r.id.toLowerCase() === want);
        if (!hit) return `no score with id "${parts[1]}" in the top 100.`;
        await deleteScore(GAME, hit.id);
        return `deleted ${hit.id}  ${hit.initials}  ${hit.score}`;
      } catch (err) {
        return `error: ${err.message}`;
      }
    }

    try {
      return list(await fetchTopScores(GAME, 20));
    } catch (err) {
      return `error: ${err.message}`;
    }
  },
};

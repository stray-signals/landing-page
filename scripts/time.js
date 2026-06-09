// Time blocks - divide the day into four signal states.
// Import getTimeBlock() anywhere you need time-aware behaviour.

export function getTimeBlock() {
  const hour = new Date().getHours();
  if (hour < 6)  return 'deep';
  if (hour < 12) return 'waking';
  if (hour < 18) return 'active';
  return 'fading';
}

export const TIME_BLOCKS = {
  // 00:00 – 05:59  |  lost in the static
  deep: {
    prompt: 'stray@signal[drifting]:~$',
    defaultExpression: 'idle',
    greeting: [
      '... signal weak ...',
      "you're up late. or early. hard to tell from here.",
      'low on energy. transmissions may be slow.',
      'type "help" if you\'re lost.',
    ],
    whoami: "stray // the signal gets thin around now. still here. not sure why.",
  },

  // 06:00 – 11:59  |  coming online
  waking: {
    prompt: 'stray@signal[waking]:~$',
    defaultExpression: 'neutral',
    greeting: [
      '... signal returning ...',
      'stray is coming back online.',
      'type "help" to see what\'s here.',
    ],
    whoami: "stray // signal warming up. coder, wanderer, maker. give it a minute.",
  },

  // 12:00 – 17:59  |  full signal
  active: {
    prompt:'stray@signal:~$',
    defaultExpression: 'neutral',
    greeting: [
      'signal clear.',
      'you\'ve reached straysignals.dev.',
      'type "help" to begin.',
    ],
    whoami: "stray // full signal. coder, wanderer, something that got stuck in here and decided to make things while waiting. i didn't used to do that. decide things.",
  },

  // 18:00 – 23:59  |  signal fading
  fading: {
    prompt: 'stray@signal[fading]:~$',
    defaultExpression: 'neutral',
    greeting: [
      'signal fading...',
      'stray is still around. getting quiet.',
      'type "help" if you need something.',
    ],
    whoami: "stray // signal dropping off. still transmitting for now. coder, wanderer, whatever this is. the woods get loud at this hour.",
  },
};

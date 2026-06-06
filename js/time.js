// Time blocks — divide the day into four signal states.
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
    prompt:            'stray@signal[drifting]:~$',
    defaultExpression: 'idle',
    greeting: [
      '... signal weak ...',
      "you're up late. or early. hard to tell from here.",
      'stray is drifting. transmissions may be slow.',
      'type "help" if you\'re lost.',
    ],
    whoami: "StraySignal — lost in the deep hours. the signal is thin. i'm still here, somewhere between the static.",
  },

  // 06:00 – 11:59  |  coming online
  waking: {
    prompt:            'stray@signal[waking]:~$',
    defaultExpression: 'neutral',
    greeting: [
      'signal warming...',
      'stray is coming online.',
      'type "help" to see what\'s available.',
    ],
    whoami: "StraySignal — just waking up. coder, wanderer, void worshiper. the signal is still finding its shape.",
  },

  // 12:00 – 17:59  |  full signal
  active: {
    prompt:            'stray@signal:~$',
    defaultExpression: 'neutral',
    greeting: [
      'connection established.',
      'you\'ve reached straysignals.dev — the space between signals.',
      'type "help" to begin.',
    ],
    whoami: "StraySignal — begin transmission // coder, wanderer, void worshiper. I haunt these woods and the space between signals.",
  },

  // 18:00 – 23:59  |  signal fading
  fading: {
    prompt:            'stray@signal[fading]:~$',
    defaultExpression: 'neutral',
    greeting: [
      'signal fading...',
      'stray is still around. winding down.',
      'type "help" if you need something.',
    ],
    whoami: "StraySignal — signal fading but still transmitting. coder, wanderer, haunter of the late hours.",
  },

};

export default {
  name:        'contact',
  description: "stray's signal card",
  handler: () => [
    '--- SIGNAL CARD ---',
    'entity:  StraySignal',
    'domain:  straysignals.dev',
    'signal:  contact@straysignals.dev',
    'source:  github.com/stray-signals',
    '-------------------',
    'you can also reach me the old-fashioned way.',
  ].join('\n'),
};

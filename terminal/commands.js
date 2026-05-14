export const COMMANDS = new Map();

COMMANDS.set('whoami', {
  description: 'Who is StraySignal?',
  run: () => 'StraySignal — begin transmission // coder, wanderer, void worshiper. I haunt these woods and the space between signals.',
});

COMMANDS.set('help', {
  description: 'List available commands',
  run: () => `Available: ${[...COMMANDS.keys()].join(', ')}`,
});

COMMANDS.set('clear', {
  description: 'Clear the terminal',
  run: () => ({ action: 'clear' }),
});

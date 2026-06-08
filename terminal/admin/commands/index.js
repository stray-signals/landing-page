import logCmd    from './log.js';
import spritesheet from './spritesheet.js';
import theme       from './theme.js';

const adminCommands = [logCmd, spritesheet, theme];

export const ADMIN_REGISTRY = new Map(adminCommands.map(cmd => [cmd.name, cmd]));

ADMIN_REGISTRY.set('logout', {
  name:        'logout',
  description: 'exit admin mode',
  handler:     () => ({ action: 'logout' }),
});

ADMIN_REGISTRY.set('help', {
  name:        'help',
  description: 'list admin commands',
  handler: () => {
    const lines = [''];
    for (const [name, cmd] of ADMIN_REGISTRY) {
      lines.push(`  ${name.padEnd(12)} ${cmd.description}`);
    }
    return lines.join('\n');
  },
});

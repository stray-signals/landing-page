import { getTimeBlock, TIME_BLOCKS } from '../../js/time.js';

const ENTITIES = {
  stray: () => {
    const bio  = TIME_BLOCKS[getTimeBlock()].whoami;
    const card = [
      '--- SIGNAL CARD ---',
      'entity:  StraySignal',
      'domain:  straysignals.dev',
      'signal:  contact@straysignals.dev',
      'source:  github.com/stray-signals',
      '-------------------',
      'you can also reach me the old-fashioned way.',
    ].join('\n');

    return `${bio}\n\n${card}`;
  },
};

export default {
  name:        'whois',
  description: 'look up an entity',
  usage:       'whois <entity>',
  handler: (args) => {
    const target = args.trim().toLowerCase();
    if (!target) return 'whois: missing entity. try "whois stray".';

    const lookup = ENTITIES[target];
    if (!lookup)  return `whois: unknown entity "${target}".`;

    return lookup();
  },
};

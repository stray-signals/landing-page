import { getTimeBlock, TIME_BLOCKS } from '../../js/time.js';

export default {
  name:        'whoami',
  description: 'who is stray?',
  handler:     () => TIME_BLOCKS[getTimeBlock()].whoami,
};

import { currentHex } from './theme.js';

export default {
  name:        'spritesheet',
  description: 'open expression spritesheet',
  handler: () => {
    const color = encodeURIComponent(currentHex);
    window.open(`/spritesheet.html?color=${color}`, '_blank', 'width=1200,height=800,noopener');
    return 'opening spritesheet...';
  },
};

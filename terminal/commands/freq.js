import { play, stop, isPlaying, getNowPlaying } from '../../js/player.js';

export default {
  name:        'freq',
  description: 'play/stop audio transmissions',
  usage:       'freq | freq stop',
  handler: (args) => {
    if (args === 'stop') {
      return stop() ? 'transmission ended.' : 'nothing is broadcasting.';
    }
    if (isPlaying()) {
      return `broadcasting: ${getNowPlaying().label}`;
    }
    const result = play();
    return `>> ${result.track.label}\ntransmission active.`;
  },
};

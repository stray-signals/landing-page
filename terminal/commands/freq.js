import { play, stop, isPlaying, getNowPlaying, getTrack } from '../../scripts/player.js';

export default {
  name:        'freq',
  description: 'play/stop audio transmissions',
  usage:       'freq [<id>] | freq stop',
  handler: (args) => {
    const target = args.trim();

    if (target === 'stop') {
      return stop() ? 'transmission ended.' : 'nothing is broadcasting.';
    }

    if (target) {
      const track = getTrack(target);
      if (!track) return `freq: unknown transmission "${target}". try ls in ~/media.`;
      const result = play(target);
      return `>> ${result.track.label}\ntransmission active.`;
    }

    // no args — report status or start default track
    if (isPlaying()) {
      return `broadcasting: ${getNowPlaying().label}`;
    }
    const result = play();
    return `>> ${result.track.label}\ntransmission active.`;
  },
};

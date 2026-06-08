// Audio player - swap `src` for a Jellyfin stream URL when you're ready.
// e.g. src: 'https://your-jellyfin.home/Audio/{itemId}/stream?api_key=...'

const TRACKS = [
  {
    id:    'field_log_0001',
    label: 'field_log_0001_rain_on_canvas.mp3',
    src:   'root/media/field_log_0001_rain_on_canvas.mp3',
    loop:  true,
  },
];

let audio = null;
let currentTrack = null;

export function getTrack(trackId) {
  return trackId ? TRACKS.find(t => t.id === trackId) ?? null : TRACKS[0];
}

export function play(trackId) {
  const track = getTrack(trackId);
  if (!track) return null;

  // Same track already loaded - resume if paused
  if (currentTrack?.id === track.id && audio) {
    if (audio.paused) {
      audio.play().catch(() => {});
      return { status: 'resumed', track };
    }
    return { status: 'already_playing', track };
  }

  // New track
  stop();
  audio = new Audio(track.src);
  audio.loop = track.loop;
  currentTrack = track;
  audio.play().catch(() => {});
  return { status: 'playing', track };
}

export function stop() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio = null;
    currentTrack = null;
    return true;
  }
  return false;
}

export function isPlaying() {
  return !!(audio && !audio.paused);
}

export function getNowPlaying() {
  return isPlaying() ? currentTrack : null;
}

export function listTracks() {
  return TRACKS;
}

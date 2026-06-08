// ── Project data ───────────────────────────────────────────────────
// Edit log[] to change what "cat projects/<id>/<id>.log" displays
// in the terminal. url is where "exe <id>" redirects.

export const PROJECTS = {
  pigeonhole: {
    id:    'pigeonhole',
    label: 'pigeonhole',
    url:   '/projects/pigeonhole/',
    log: [
      '[project] pigeonhole',
      'built a thing. it watches faces and puts them in the right box.',
      'no cloud. no subscription. just pattern recognition and a folder structure.',
      'photographers seem relieved by it.',
      'took more out of me than expected. the face matching part especially.',
      'something about teaching a machine to recognize a face',
      'feels like it should cost more than it does.',
      'run "exe pigeonhole" to open it.',
    ],
  },

  roam: {
    id:    'roam',
    label: 'roam',
    url:   '/projects/roam/',
    log: [
      '[project] roam',
      'built a camera. for a small wanderer i know.',
      'no screen. no delete. just press and trust.',
      'there is a wren on it. she reacts to things.',
      'i understand that more than i expected to.',
      'this one cost something different.',
      'run "exe roam" to open it.',
    ],
  },
};

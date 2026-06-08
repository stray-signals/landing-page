export default {
  name:        'unknown-command',
  description: 'Unrecognized command entered — glitch flash',
  trigger:     { on: 'document', event: 'avatar:unknowncommand' },
  eyes:        'glitched',
  mouth:       'tense',
  revert:      900,
};

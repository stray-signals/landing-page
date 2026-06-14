export default {
  name:        'click',
  description: 'Clicking on stray makes them upset.',
  trigger:     { on: 'canvas', event: 'click' },
  eyes:        'angry',
  mouth:       'tense',
  revert:      1500,

  handler({ forceShow, setDefault, pauseDefault, resetIdleTimers }) {
    let frustrationClicks      = 0;
    let frustrationResetTimeout;

    return () => {
      pauseDefault();
      forceShow('angry', 'tense');
      frustrationClicks++;

      clearTimeout(frustrationResetTimeout);

      if (frustrationClicks >= 3) {
        document.dispatchEvent(new CustomEvent('avatar:overtapped'));
        frustrationClicks = 0;
      }

      frustrationResetTimeout = setTimeout(() => {
        frustrationClicks = 0;
        setDefault();
      }, 1500);

      resetIdleTimers();
    };
  },
};

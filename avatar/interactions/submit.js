export default {
  name:        'submit',
  description: 'Terminal command submitted - Stray talks back, flickering talking/talkingTwo, then settles to flat',
  trigger:     { on: 'document', event: 'avatar:submit' },
  eyes:        'skeptical',
  mouth:       'talking',

  handler({ show, setDefault, pauseDefault, resetIdleTimers }) {
    return () => {
      pauseDefault();
      resetIdleTimers();

      let frame = false;
      let ticks = 0;
      const maxTicks = 8;
      const interval = setInterval(() => {
        frame = !frame;
        ticks++;
        show('normal', frame ? 'talking' : 'talkingTwo');
        if (ticks >= maxTicks) {
          clearInterval(interval);
          show('normal', 'flat');
          setDefault();
        }
      }, 150);
    };
  },
};

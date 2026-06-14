export default {
  name:        'submit',
  description: 'Stray responds - flickers talking/talkingTwo for a duration based on response word count, then settles to flat',
  trigger:     { on: 'document', event: 'avatar:responding' },
  eyes:        'normal',
  mouth:       'talking',

  handler({ show, setDefault, pauseDefault, resetIdleTimers }) {
    return (e) => {
      pauseDefault();
      resetIdleTimers();

      const words = e.detail?.words ?? 0;
      const maxTicks = Math.max(4, Math.round(words * 0.8));

      let frame = false;
      let ticks = 0;
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

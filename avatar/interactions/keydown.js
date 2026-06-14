export default {
  name:        'keydown',
  description: 'Keypress in terminal - normal/flat while typing, resets idle timers',
  trigger:     { on: 'document', event: 'avatar:keydown' },
  eyes:        'normal',
  mouth:       'flat',

  handler({ show, setDefault, pauseDefault, resetIdleTimers }) {
    let typingTimer;

    return () => {
      pauseDefault();
      show('normal', 'flat');

      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        setDefault();
      }, 800);

      resetIdleTimers();
    };
  },
};

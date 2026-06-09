export default {
  name:        'keydown',
  description: 'Keypress in terminal - talking/flat flicker while typing, reverts 800ms after last key',
  trigger:     { on: 'document', event: 'avatar:keydown' },
  eyes:        'normal',
  mouth:       'talking',

  handler({ show, setDefault, pauseDefault, resetIdleTimers }) {
    let talkFlicker = false;
    let typingTimer;

    return () => {
      pauseDefault();
      talkFlicker = !talkFlicker;
      show('normal', talkFlicker ? 'talking' : 'flat');

      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        talkFlicker = false;
        setDefault();
      }, 800);

      resetIdleTimers();
    };
  },
};

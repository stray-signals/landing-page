export default {
  name:        'reopened',
  description: 'Avatar window reopened - unamused at having to reappear, reverts after 2s. Bypasses deep mode.',
  trigger:     { on: 'document', event: 'avatar:reopened' },
  eyes:        'unamused',
  mouth:       'flat',

  handler({ forceShow, setDefault, pauseDefault, resetIdleTimers }) {
    return () => {
      pauseDefault();
      forceShow('unamused', 'flat');
      setTimeout(setDefault, 2000);
      resetIdleTimers();
    };
  },
};

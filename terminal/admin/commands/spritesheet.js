export default {
  name:        'spritesheet',
  description: 'open expression spritesheet',
  handler: () => {
    window.open('/spritesheet.html', '_blank', 'width=1200,height=800,noopener');
    return 'opening spritesheet...';
  },
};

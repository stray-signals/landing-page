export default {
  name:        'unhover',
  description: 'Mouse leaves the avatar canvas — return to default state',
  trigger:     { on: 'canvas', event: 'mouseleave' },
  default:     true,
};

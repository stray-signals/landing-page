export default {
  name:        'ls',
  description: 'list available files and locations',
  handler: () => [
    '-rw-r--r--  transmissions.log    stray\'s field notes  →  cat transmissions.log',
    'drwxr-xr-x  projects/            [signal lost]',
    'drwxr-xr-x  models/              [signal lost]',
    'drwxr-xr-x  portals/             [signal lost]',
  ].join('\n'),
};

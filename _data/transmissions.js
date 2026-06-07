// Feeds transmissions/log.json into 11ty's template engine.
// The `transmissions` key becomes available in all templates.
const fs   = require('fs');
const path = require('path');

module.exports = function() {
  const raw = fs.readFileSync(
    path.join(__dirname, '..', 'transmissions', 'log.json'),
    'utf-8'
  );
  return JSON.parse(raw);
};

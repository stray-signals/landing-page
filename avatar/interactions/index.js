import hover          from './hover.js';
import unhover        from './unhover.js';
import click          from './click.js';
import keydown        from './keydown.js';
import submit         from './submit.js';
import unknownCommand from './unknown-command.js';
import idle10         from './idle-10.js';
import idle30         from './idle-30.js';
import reopened       from './reopened.js';

export const INTERACTIONS = [
  hover,
  unhover,
  click,
  keydown,
  submit,
  unknownCommand,
  idle10,
  idle30,
  reopened,
];

export const INTERACTION_MAP = new Map(INTERACTIONS.map(i => [i.name, i]));

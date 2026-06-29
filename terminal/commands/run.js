import { PROJECTS } from '../projects.data.js';

export default {
  name:        'run',
  description: 'runs a application',
  usage:       'run <project>',
  handler: (args) => {
    const pipeIdx = args.indexOf('|');
    const target  = (pipeIdx === -1 ? args : args.slice(0, pipeIdx)).trim().toLowerCase();
    const extra   = pipeIdx === -1 ? null : args.slice(pipeIdx + 1).trim();

    if (target === 'transmit') return { action: 'openTransmit', password: extra };

    const project = PROJECTS[target];

    if (!project) {
      const available = Object.keys(PROJECTS).join(', ');
      return `run: unknown project "${target}"\navailable: ${available}`;
    }

    sessionStorage.setItem('stray_ref', 'terminal');
    window.location.href = project.url;
    return `launching ${project.label}...`;
  },
};

import { PROJECTS } from '../projects.data.js';

export default {
  name:        'run',
  description: 'runs a application',
  usage:       'run <project>',
  handler: (args) => {
    const id = args.trim().toLowerCase();
    const project = PROJECTS[id];

    if (!project) {
      const available = Object.keys(PROJECTS).join(', ');
      return `run: unknown project "${id}"\navailable: ${available}`;
    }

    sessionStorage.setItem('stray_ref', 'terminal');
    window.location.href = project.url;
    return `launching ${project.label}...`;
  },
};

import { PROJECTS } from '../projects.data.js';

export default {
  name:        'exe',
  description: 'open a project page',
  usage:       'exe <project>',
  handler: (args) => {
    const id = args.trim().toLowerCase();
    const project = PROJECTS[id];

    if (!project) {
      const available = Object.keys(PROJECTS).join(', ');
      return `exe: unknown project "${id}"\navailable: ${available}`;
    }

    const url = project.url + '?ref=terminal';
    window.location.href = url;
    return `launching ${project.label}...`;
  },
};

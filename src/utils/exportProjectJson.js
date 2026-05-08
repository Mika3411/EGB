import { downloadBlob } from './fileHelpers';

export function exportProjectJson(project) {
  downloadBlob('escape-game-project.json', new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
}

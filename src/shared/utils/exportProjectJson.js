import { downloadBlob } from './fileHelpers';
import { normalizeRouteMapCanvasesForExport } from './exportAssetBundler';

export function exportProjectJson(project) {
  const exportProject = JSON.parse(JSON.stringify(project || {}));
  normalizeRouteMapCanvasesForExport(exportProject.routeMap);
  downloadBlob('escape-game-project.json', new Blob([JSON.stringify(exportProject, null, 2)], { type: 'application/json' }));
}

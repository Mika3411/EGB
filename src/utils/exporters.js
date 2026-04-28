import JSZip from 'jszip';
import { buildExportProjectWithAssets } from './exportAssetBundler';
import { buildStandaloneHtml } from './standaloneHtml';
import { downloadBlob } from './fileHelpers';

export function exportProjectJson(project) {
  downloadBlob('escape-game-project.json', new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
}

export async function exportStandalone(project) {
  const zip = new JSZip();
  const gameFolder = zip.folder('jeu-exporte');
  const exportProject = buildExportProjectWithAssets(project, gameFolder);
  const html = buildStandaloneHtml(exportProject);

  gameFolder.file('index.html', html);
  gameFolder.file('project.json', JSON.stringify(exportProject, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob('jeu-exporte-pret-a-jouer.zip', blob);
}

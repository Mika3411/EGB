import JSZip from 'jszip';
import { buildExportProjectWithAssets } from './exportAssetBundler';
import { buildStandaloneModuleFiles } from './standaloneHtml';
import { downloadBlob } from './fileHelpers';

export async function exportStandalone(project) {
  const zip = new JSZip();
  const gameFolder = zip.folder('jeu-exporte');
  const exportProject = buildExportProjectWithAssets(project, gameFolder);
  const { indexHtml, engineJs } = buildStandaloneModuleFiles(exportProject);

  gameFolder.file('index.html', indexHtml);
  gameFolder.file('engine.js', engineJs);
  gameFolder.file('project.json', JSON.stringify(exportProject, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob('jeu-exporte-prêt-a-jouer.zip', blob);
}

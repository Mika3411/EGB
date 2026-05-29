import JSZip from 'jszip';
import { buildExportProjectWithAssets } from './exportAssetBundler';
import { buildStandaloneModuleFiles } from './standaloneHtml';
import { downloadBlob } from './fileHelpers';

export async function exportStandalone(project, options = {}) {
  const zip = new JSZip();
  const gameFolder = zip.folder('jeu-exporte');
  let offlineAssetsSummary = null;
  const exportProject = await buildExportProjectWithAssets(project, gameFolder, {
    ...options,
    onOfflineAssetsSummary: (summary) => {
      offlineAssetsSummary = summary;
      options.onOfflineAssetsSummary?.(summary);
    },
  });
  const { indexHtml, engineJs, styleCss } = buildStandaloneModuleFiles(exportProject);

  gameFolder.file('index.html', indexHtml);
  gameFolder.file('engine.js', engineJs);
  gameFolder.file('style.css', styleCss);
  gameFolder.file('project.json', JSON.stringify(exportProject, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = 'jeu-exporte-prêt-a-jouer.zip';
  downloadBlob(filename, blob);

  return {
    filename,
    blob,
    offlineAssetsSummary,
    offlineAssetsMessage: offlineAssetsSummary?.message || '',
  };
}

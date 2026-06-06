import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filesToCheck = [
  'src/app/ShellApp.jsx',
  'src/app/builder/hooks/useAutosaveProject.js',
  'src/domains/auth/hooks/useAccountStorage.js',
  'src/shared/hooks/useMediaSourcePicker.js',
  'src/domains/profile/hooks/useProfileProjectActions.js',
  'src/shared/ui/AccessibleDialog.jsx',
  'src/shared/ui/media/MediaSourceModal.jsx',
  'src/shared/ui/media/MediaSourcePicker.jsx',
  'src/app/builder/navigation/domainTabs.jsx',
  'src/__tests__/extracted-flows.regression.test.jsx',
];

const failures = [];
const textExtensions = new Set(['.js', '.jsx', '.css', '.md', '.json']);
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules']);
const mojibakePattern = /[\u00c3\u00c2\ufffd]|\u00e2[\u0080-\u00bf\u20ac\u2122\u0153\u009d]/;
const maxSourceLineCount = 1200;
// Files below belong to the RPG 3D/model import surface and are tracked separately
// from this classic builder release check.
const ignoredOversizedSourceFiles = new Set([
  'server/modelTools.js',
  'src/domains/rpg3d/arcade/ArcadeThreeViewport.jsx',
  'src/domains/rpg3d/arcade/rpg3dActorRigging.js',
  'src/domains/rpg3d/arcade/rpg3dSceneActors.js',
  'src/domains/characters/CharacterStudio.jsx',
  'src/domains/rpg3d/rigging/DecorStudio.jsx',
  'src/domains/rpg3d/rigging/ObjectRiggingWorkspace.jsx',
  'src/domains/characters/preview/Character3DPreview.jsx',
  'src/domains/rpg3d/components/Decor3DPreview.jsx',
  'src/domains/rpg3d/components/Decor3DPreviewRuntime.js',
  'src/domains/rpg3d/components/rpg3dModeShared.js',
  'src/domains/rpg3d/Rpg3DStudio.jsx',
  'src/domains/rpg3d/stunts/StuntCharacter3DPreview.jsx',
  'src/__tests__/rpg3dSceneBuilders.test.js',
]);
const oversizedSourceAllowlist = new Map([
  ['src/domains/anime2d/Anime2DStudio.jsx', 2352],
  ['src/domains/scenes/narrative/NarrativeWorkspace.jsx', 2151],
  ['src/domains/scenes/routes/SceneRouteMap.jsx', 2135],
  ['src/domains/characters/hero/HeroDesigner.jsx', 1894],
  ['src/shared/utils/aiProjectGenerator.js', 1812],
  ['src/app/BuilderStudio.jsx', 1798],
  ['src/shared/utils/standalone/standaloneTemplate.js', 1610],
  ['src/domains/ai/AiWorkbench.jsx', 1426],
  ['src/domains/combat/CombatWorkspace.jsx', 1417],
  ['src/shared/data/tutorialStepData.js', 1903],
  ['src/domains/player/PlaytestWorkspace.jsx', 1269],
  ['src/domains/help/HelpCenter.jsx', 1220],
  ['src/shared/data/projectData.js', 1209],
  ['src/shared/services/combatEngine.js', 1203],
]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toRelativePath = (file) => path.relative(root, file).split(path.sep).join('/');

const countLines = (text) => {
  if (!text) return 0;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const withoutFinalNewline = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return withoutFinalNewline ? withoutFinalNewline.split('\n').length : 1;
};

const collectFilesWithExtensions = (directory, extensions) => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) return [];
      return collectFilesWithExtensions(fullPath, extensions);
    }
    return extensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
};

const collectTextFiles = (directory) => collectFilesWithExtensions(directory, textExtensions);

const collectImportedNames = (statement) => {
  const names = [];
  const defaultMatch = statement.match(/^import\s+([A-Za-z_$][\w$]*)\s*(?:,|\s+from)/);
  if (defaultMatch && defaultMatch[1] !== 'React') names.push(defaultMatch[1]);

  const namedMatch = statement.match(/\{([^}]+)\}/);
  if (namedMatch) {
    namedMatch[1].split(',').forEach((entry) => {
      const localName = entry.trim().split(/\s+as\s+/).pop()?.trim();
      if (localName) names.push(localName);
    });
  }
  return names;
};

for (const file of collectTextFiles(path.join(root, 'src'))) {
  const relativeFile = toRelativePath(file);
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    if (mojibakePattern.test(line)) {
      failures.push(`${relativeFile}:${index + 1}: possible mojibake detected`);
    }
  });
}

for (const file of collectFilesWithExtensions(root, sourceExtensions)) {
  const relativeFile = toRelativePath(file);
  if (ignoredOversizedSourceFiles.has(relativeFile)) continue;
  const lineCount = countLines(fs.readFileSync(file, 'utf8'));
  const allowedLineCount = oversizedSourceAllowlist.get(relativeFile);

  if (lineCount <= maxSourceLineCount) continue;

  if (allowedLineCount === undefined) {
    failures.push(
      `${relativeFile}: ${lineCount} lines exceeds ${maxSourceLineCount}-line limit for JS/JSX/TS/TSX files`,
    );
  } else if (lineCount > allowedLineCount) {
    failures.push(
      `${relativeFile}: ${lineCount} lines exceeds temporary allowlist cap of ${allowedLineCount} lines for JS/JSX/TS/TSX files`,
    );
  }
}

for (const relativeFile of filesToCheck) {
  const file = path.join(root, relativeFile);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');

  const importStatements = text.match(/import[\s\S]*?from\s+['"][^'"]+['"];?/g) || [];
  for (const statement of importStatements) {
    const body = text.slice(text.indexOf(statement) + statement.length);
    collectImportedNames(statement).forEach((name) => {
      const usage = new RegExp(`\\b${escapeRegExp(name)}\\b`);
      if (!usage.test(body)) {
        failures.push(`${relativeFile}: unused import candidate "${name}"`);
      }
    });
  }

  const effectPattern = /useEffect\([\s\S]*?,\s*\[([^\]]*)\]\s*\)/g;
  for (const match of text.matchAll(effectPattern)) {
    if (/(^|,)\s*(editor|preview)\s*(,|$)/.test(match[1])) {
      failures.push(`${relativeFile}: useEffect depends on whole editor/preview object`);
    }
  }
}

const distIndexPath = path.join(root, 'dist', 'index.html');
if (fs.existsSync(distIndexPath)) {
  const distIndex = fs.readFileSync(distIndexPath, 'utf8');
  const forbiddenInitialAssets = [
    /\.wasm/i,
    /onnxruntime/i,
    /ort-wasm/i,
    /ort\.bundle/i,
    /ort\.webgpu/i,
    /Anime2DStudio/i,
  ];

  forbiddenInitialAssets.forEach((pattern) => {
    if (pattern.test(distIndex)) {
      failures.push(`dist/index.html: heavy 2D/ONNX asset appears in the initial document (${pattern})`);
    }
  });
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('release check passed');

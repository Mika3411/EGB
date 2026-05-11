import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filesToCheck = [
  'src/App.jsx',
  'src/hooks/useAutosaveProject.js',
  'src/hooks/useAccountStorage.js',
  'src/hooks/useMediaSourcePicker.js',
  'src/hooks/useProfileProjectActions.js',
  'src/components/AccessibleDialog.jsx',
  'src/components/MediaSourceModal.jsx',
  'src/components/MediaSourcePicker.jsx',
  'src/components/TabRegistry.jsx',
  'src/__tests__/extracted-flows.regression.test.jsx',
];

const failures = [];
const textExtensions = new Set(['.js', '.jsx', '.css', '.md', '.json']);
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules']);
const mojibakePattern = /[\u00c3\u00c2\ufffd]|\u00e2[\u0080-\u00bf\u20ac\u2122\u0153\u009d]/;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const collectTextFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) return [];
      return collectTextFiles(fullPath);
    }
    return textExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
};

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
  const relativeFile = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    if (mojibakePattern.test(line)) {
      failures.push(`${relativeFile}:${index + 1}: possible mojibake detected`);
    }
  });
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
    /TwoDAnimeEditor/i,
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

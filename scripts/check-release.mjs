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
const mojibakePattern = /Ã|Â|â€™|â€œ|â€|�/;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

for (const relativeFile of filesToCheck) {
  const file = path.join(root, relativeFile);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');

  if (mojibakePattern.test(text)) {
    failures.push(`${relativeFile}: possible mojibake detected`);
  }

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

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('release check passed');

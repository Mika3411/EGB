import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

const removePath = async (targetPath) => {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

const listFiles = async (targetDir) => {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

const pruned = [];

const generatedAssetsDir = path.join(distDir, 'assets', 'generated');
if (await removePath(generatedAssetsDir)) pruned.push(path.relative(root, generatedAssetsDir));

const characterDir = path.join(distDir, 'assets', '3d', 'characters');
const characterFiles = await listFiles(characterDir);
for (const fileName of characterFiles) {
  if (!/^Meshy_AI_.*\.glb$/i.test(fileName)) continue;
  const targetPath = path.join(characterDir, fileName);
  if (await removePath(targetPath)) pruned.push(path.relative(root, targetPath));
}

if (pruned.length) {
  console.log(`Pruned ${pruned.length} heavy deploy artifact(s):`);
  pruned.forEach((entry) => console.log(`- ${entry}`));
} else {
  console.log('No heavy deploy artifacts to prune.');
}

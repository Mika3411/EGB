import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const ASSET_DIR = path.join(ROOT, 'public', 'assets', 'generated', 'caribbean-treasure');
const LOCAL_PROJECT_PATH = path.join(ASSET_DIR, 'caribbean-treasure-project.json');
const DOC_PROJECT_PATH = path.join(ROOT, 'docs', 'examples', 'chasse-tresor-caraibes.json');
const VALIDATION_PATH = path.join(ROOT, 'docs', 'examples', 'chasse-tresor-caraibes.validation.json');
const W = 1672;
const H = 941;

const loadEnvFile = () => {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) {
      process.env[key] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
};

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_PUBLIC_ASSETS_BUCKET || process.env.VITE_SUPABASE_PUBLIC_ASSETS_BUCKET;

if (!supabaseUrl || !serviceRoleKey || !bucket) {
  throw new Error('Configuration Supabase incomplete: URL, service role key, or public bucket missing.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const contentTypeFor = (fileName) => {
  if (fileName.endsWith('.json')) return 'application/json';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
};

const uploadFile = async (localPath, storagePath) => {
  const buffer = await fs.readFile(localPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    upsert: true,
    contentType: contentTypeFor(localPath),
    cacheControl: localPath.endsWith('.json') ? '0' : '3600',
  });
  if (error) throw new Error(`${storagePath}: ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
};

const publicPathToFileName = (value = '') => String(value).split('/').pop();

const replaceAssetUrl = (value, urlByFileName) => {
  const fileName = publicPathToFileName(value);
  return urlByFileName.get(fileName) || value;
};

const collectImageNames = (project) => {
  const names = new Set();
  project.scenes.forEach((scene) => names.add(scene.backgroundName || publicPathToFileName(scene.backgroundData)));
  project.items.forEach((item) => names.add(item.imageName || publicPathToFileName(item.imageData)));
  project.cinematics.forEach((cinematic) => cinematic.slides.forEach((slide) => names.add(slide.imageName || publicPathToFileName(slide.imageData))));
  project.enigmas.forEach((enigma) => {
    if (enigma.imageName || enigma.imageData) names.add(enigma.imageName || publicPathToFileName(enigma.imageData));
    if (enigma.popupBackgroundName || enigma.popupBackgroundData) names.add(enigma.popupBackgroundName || publicPathToFileName(enigma.popupBackgroundData));
  });
  return [...names].filter(Boolean).sort();
};

const validateLocalMedia = async (project) => {
  const checks = [];
  project.scenes.forEach((scene) => checks.push({ fileName: scene.backgroundName, w: W, h: H, alpha: false }));
  project.cinematics.forEach((cinematic) => cinematic.slides.forEach((slide) => checks.push({ fileName: slide.imageName, w: W, h: H, alpha: false })));
  project.enigmas.forEach((enigma) => {
    if (enigma.imageName) checks.push({ fileName: enigma.imageName, w: W, h: H, alpha: false });
    if (enigma.popupBackgroundName) checks.push({ fileName: enigma.popupBackgroundName, w: 512, h: 512, alpha: true });
  });
  project.items.forEach((item) => checks.push({ fileName: item.imageName, w: 512, h: 512, alpha: true }));

  const errors = [];
  for (const check of checks) {
    const localPath = path.join(ASSET_DIR, check.fileName);
    const meta = await sharp(localPath).metadata();
    if (meta.width !== check.w || meta.height !== check.h) {
      errors.push(`${check.fileName}: expected ${check.w}x${check.h}, got ${meta.width}x${meta.height}`);
    }
    if (check.alpha && !meta.hasAlpha) errors.push(`${check.fileName}: missing alpha`);
  }
  return errors;
};

const validateRefs = (project) => {
  const errors = [];
  const ids = {
    scenes: new Set(project.scenes.map((entry) => entry.id)),
    items: new Set(project.items.map((entry) => entry.id)),
    enigmas: new Set(project.enigmas.map((entry) => entry.id)),
    cinematics: new Set(project.cinematics.map((entry) => entry.id)),
    hotspots: new Set(project.scenes.flatMap((scene) => scene.hotspots.map((entry) => entry.id))),
    replies: new Set(project.scenes.flatMap((scene) => scene.hotspots.flatMap((spot) => (
      spot.conversation?.nodes || []
    ).flatMap((node) => (node.replies || []).map((reply) => reply.id))))),
  };

  const ref = (setName, id, source) => {
    if (id && !ids[setName].has(id)) errors.push(`${source}: missing ${setName} ref ${id}`);
  };

  project.scenes.forEach((scene) => {
    scene.hotspots.forEach((spot) => {
      ref('scenes', spot.targetSceneId, spot.id);
      ref('cinematics', spot.targetCinematicId, spot.id);
      ref('enigmas', spot.enigmaId, spot.id);
      ref('items', spot.rewardItemId, spot.id);
      ref('items', spot.requiredItemId, spot.id);
      (spot.logicRules || []).forEach((rule) => {
        ref('scenes', rule.targetSceneId, rule.id);
        ref('cinematics', rule.targetCinematicId, rule.id);
        ref('enigmas', rule.enigmaId || rule.conditionEnigmaId, rule.id);
        ref('items', rule.rewardItemId || rule.itemId, rule.id);
        (rule.advancedConditions || []).forEach((condition) => {
          ref('scenes', condition.sceneId, condition.id);
          ref('enigmas', condition.enigmaId, condition.id);
          ref('items', condition.itemId, condition.id);
          ref('hotspots', condition.hotspotId, condition.id);
          ref('replies', condition.replyId, condition.id);
        });
      });
      (spot.conversation?.nodes || []).forEach((node) => {
        (node.replies || []).forEach((reply) => {
          ref('scenes', reply.targetSceneId, reply.id);
          ref('cinematics', reply.targetCinematicId, reply.id);
          ref('enigmas', reply.enigmaId, reply.id);
          ref('items', reply.rewardItemId, reply.id);
        });
      });
    });
  });

  project.enigmas.forEach((enigma) => {
    ref('scenes', enigma.targetSceneId, enigma.id);
    ref('cinematics', enigma.targetCinematicId, enigma.id);
    (enigma.clueSceneIds || []).forEach((sceneId) => ref('scenes', sceneId, enigma.id));
  });

  project.combinations.forEach((combo) => {
    ref('items', combo.itemAId, combo.id);
    ref('items', combo.itemBId, combo.id);
    ref('items', combo.resultItemId, combo.id);
  });

  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  project.scenes.forEach((scene) => {
    scene.hotspots
      .filter((spot) => spot.actionType === 'scene' && spot.targetSceneId)
      .forEach((spot) => {
        const target = sceneById.get(spot.targetSceneId);
        const hasReturn = (target?.hotspots || []).some((entry) => entry.actionType === 'scene' && entry.targetSceneId === scene.id);
        if (!hasReturn) errors.push(`navigation has no return: ${scene.id} -> ${spot.targetSceneId}`);
      });
  });

  const enigmaHostScenes = new Map();
  project.scenes.forEach((scene) => {
    scene.hotspots.forEach((spot) => {
      if (!spot.enigmaId) return;
      if (!enigmaHostScenes.has(spot.enigmaId)) enigmaHostScenes.set(spot.enigmaId, new Set());
      enigmaHostScenes.get(spot.enigmaId).add(scene.id);
    });
  });
  project.enigmas.forEach((enigma) => {
    const hostScenes = enigmaHostScenes.get(enigma.id) || new Set();
    (enigma.clueSceneIds || []).forEach((sceneId) => {
      if (hostScenes.has(sceneId)) errors.push(`${enigma.id}: clue in host scene ${sceneId}`);
    });
  });

  return errors;
};

const rewriteProjectUrls = (project, urlByFileName, jsonUrl = '') => {
  const next = structuredClone(project);
  next.exportedAt = new Date().toISOString();
  next.scenes.forEach((scene) => {
    scene.backgroundData = replaceAssetUrl(scene.backgroundData, urlByFileName);
  });
  next.items.forEach((item) => {
    item.imageData = replaceAssetUrl(item.imageData, urlByFileName);
  });
  next.cinematics.forEach((cinematic) => {
    cinematic.slides.forEach((slide) => {
      slide.imageData = replaceAssetUrl(slide.imageData, urlByFileName);
    });
  });
  next.enigmas.forEach((enigma) => {
    if (enigma.imageData) enigma.imageData = replaceAssetUrl(enigma.imageData, urlByFileName);
    if (enigma.popupBackgroundData) enigma.popupBackgroundData = replaceAssetUrl(enigma.popupBackgroundData, urlByFileName);
  });
  next.metadata = {
    ...(next.metadata || {}),
    visualStyle: 'Rendu réaliste cinématographique: Caraïbes nocturnes, lanternes chaudes, mer turquoise, bois salé, cuivre et corail.',
    storageMode: 'supabase-public-assets',
    supabaseBucket: bucket,
    supabaseJsonUrl: jsonUrl || next.metadata?.supabaseJsonUrl || '',
  };
  return next;
};

const project = JSON.parse(await fs.readFile(LOCAL_PROJECT_PATH, 'utf8'));
const mediaErrors = await validateLocalMedia(project);
const refErrors = validateRefs(project);
if (mediaErrors.length || refErrors.length) {
  throw new Error([...mediaErrors, ...refErrors].join('\n'));
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').toLowerCase();
const storageBase = `generated/caribbean-treasure/${stamp}`;
const imageNames = collectImageNames(project);
const urlByFileName = new Map();

for (const fileName of imageNames) {
  const localPath = path.join(ASSET_DIR, fileName);
  const storagePath = `${storageBase}/${fileName}`;
  const publicUrl = await uploadFile(localPath, storagePath);
  urlByFileName.set(fileName, publicUrl);
  console.log(`uploaded ${fileName}`);
}

let finalProject = rewriteProjectUrls(project, urlByFileName);
await fs.writeFile(LOCAL_PROJECT_PATH, `${JSON.stringify(finalProject, null, 2)}\n`, 'utf8');
await fs.writeFile(DOC_PROJECT_PATH, `${JSON.stringify(finalProject, null, 2)}\n`, 'utf8');

const projectStoragePath = `${storageBase}/chasse-tresor-caraibes.json`;
const projectUrl = await uploadFile(DOC_PROJECT_PATH, projectStoragePath);
finalProject = rewriteProjectUrls(finalProject, urlByFileName, projectUrl);
await fs.writeFile(LOCAL_PROJECT_PATH, `${JSON.stringify(finalProject, null, 2)}\n`, 'utf8');
await fs.writeFile(DOC_PROJECT_PATH, `${JSON.stringify(finalProject, null, 2)}\n`, 'utf8');
await uploadFile(DOC_PROJECT_PATH, projectStoragePath);

const validation = {
  ok: true,
  canonicalProjectPath: DOC_PROJECT_PATH,
  supabaseProjectUrl: projectUrl,
  supabaseBucket: bucket,
  supabaseStorageBase: storageBase,
  counts: {
    acts: finalProject.acts.length,
    scenes: finalProject.scenes.length,
    enigmas: finalProject.enigmas.length,
    cinematics: finalProject.cinematics.length,
    cinematicSlides: finalProject.cinematics.reduce((sum, cine) => sum + cine.slides.length, 0),
    items: finalProject.items.length,
    combinations: finalProject.combinations.length,
    hotspots: finalProject.scenes.reduce((sum, scene) => sum + scene.hotspots.length, 0),
    logicRules: finalProject.scenes.reduce((sum, scene) => sum + scene.hotspots.reduce((inner, spot) => inner + (spot.logicRules || []).length, 0), 0),
    uploadedImages: imageNames.length,
  },
  checked: [
    'native builder references',
    'navigation returns',
    'clues outside enigma rooms',
    'local media dimensions',
    'item alpha channel',
    'supabase public URLs written into JSON',
  ],
  notes: [
    'All imageData/backgroundData/popupBackgroundData values point to Supabase public URLs.',
    'The local JSON in public/assets/generated/caribbean-treasure and docs/examples is the same uploaded project.',
  ],
  generatedAt: new Date().toISOString(),
};
await fs.writeFile(VALIDATION_PATH, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ projectUrl, validationPath: VALIDATION_PATH, storageBase, images: imageNames.length }, null, 2));

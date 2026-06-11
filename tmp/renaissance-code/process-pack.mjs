import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(os.homedir(), '.codex', 'generated_images', '019eb3ac-e4d6-79a1-a854-9f286d5914d7');
const outDir = path.join(root, 'public', 'assets', 'generated', 'renaissance-code');
const tmpDir = path.join(root, 'tmp', 'renaissance-code');
const sourceCopyDir = path.join(tmpDir, 'sources');
const alphaDir = path.join(tmpDir, 'alpha');
const contactDir = path.join(tmpDir, 'contact-sheets');
const helper = path.join(os.homedir(), '.codex', 'skills', '.system', 'imagegen', 'scripts', 'remove_chroma_key.py');
const publicBase = '/assets/generated/renaissance-code';
const sceneSize = { width: 1672, height: 941 };
const itemSize = { width: 512, height: 512 };

const scenes = [
  ['scene-01-galerie-renaissance.png', 'Galerie Renaissance'],
  ['scene-02-atelier-restauration.png', 'Atelier de restauration'],
  ['scene-03-archives-manuscrits.png', 'Archives des manuscrits'],
  ['scene-04-cabinet-miroirs.png', 'Cabinet des miroirs'],
  ['scene-05-salle-astronomie.png', 'Salle d astronomie'],
  ['scene-06-chapelle-vitraux.png', 'Chapelle aux vitraux'],
  ['scene-07-palier-crypte.png', 'Palier de la crypte'],
  ['scene-08-couloir-ossuaire.png', 'Couloir ossuaire'],
  ['scene-09-bibliotheque-secrete.png', 'Bibliotheque secrete'],
  ['scene-10-horloge-mecanisme.png', 'Salle du mecanisme'],
  ['scene-11-bureau-conservateur.png', 'Bureau du conservateur'],
  ['scene-12-observatoire-toit.png', 'Observatoire du toit'],
  ['scene-13-voute-reliquaires.png', 'Voute des reliquaires'],
  ['scene-14-tunnel-eaux.png', 'Tunnel des eaux'],
  ['scene-15-sanctum-final.png', 'Sanctum final'],
].map(([fileName, name], index) => ({
  sourceIndex: index + 1,
  id: fileName.replace(/\.png$/, '').replace(/-/g, '_'),
  name,
  fileName,
  type: 'scene',
}));

const items = [
  ['item-medaille-soleil.png', 'Medaille solaire', 'sun'],
  ['item-roue-chiffrement.png', 'Roue de chiffrement', 'disc'],
  ['item-cle-triangulaire.png', 'Cle triangulaire', 'key'],
  ['item-miroir-bronze.png', 'Miroir de bronze', 'mirror'],
  ['item-fragment-codex.png', 'Fragment de codex', 'scroll'],
  ['item-sceau-cire.png', 'Sceau de cire', 'stamp'],
  ['item-lentille-ambre.png', 'Lentille ambree', 'lens'],
  ['item-stylet-os.png', 'Stylet d os', 'pen'],
  ['item-carte-pliee.png', 'Carte pliee', 'map'],
  ['item-coffret-reliquaire.png', 'Coffret reliquaire', 'box'],
].map(([fileName, name, icon], index) => ({
  sourceIndex: index + 16,
  id: fileName.replace(/\.png$/, '').replace(/-/g, '_'),
  name,
  icon,
  fileName,
  type: 'item',
}));

const cinematicSlides = [
  ['cine-intro-01-cour-musee.png', 'La cour du musee', 26],
  ['cine-intro-02-codex-scelle.png', 'Le codex scelle', 27],
  ['cine-intro-03-escalier-secret.png', 'L escalier secret', 28],
  ['cine-final-01-alignement.png', 'L alignement', 29],
  ['cine-final-02-manuscrit.png', 'Le manuscrit', 30],
  // Source 31 was rejected because it looked like a recognizable real museum courtyard.
  ['cine-final-03-aube.png', 'La sortie a l aube', 32],
].map(([fileName, name, sourceIndex]) => ({
  sourceIndex,
  id: fileName.replace(/\.png$/, '').replace(/-/g, '_'),
  name,
  fileName,
  type: 'cinematic',
}));

const intros = [
  'La galerie dort sous les verrieres. Trois passages suffisent a transformer une visite en enquete.',
  'Les pigments et les outils de restauration attendent encore. Quelqu un a deplace une piece du puzzle.',
  'Les manuscrits sont classes, verrouilles, presque trop silencieux. Le codex ouvert n est pas la reponse, mais il indique la forme.',
  'Les miroirs renvoient les symboles dans le bon sens. Le bureau cache plus qu une simple note.',
  'Les planetes de laiton entourent le soleil central. Une lentille manque pour lire le ciel.',
  'Les vitraux decoupent le sol en couleurs nettes. L autel garde son compartiment ferme.',
  'Sous la chapelle, la pierre devient froide. La serrure attend cinq petales solaires.',
  'L ossuaire range les morts comme une bibliotheque range les livres. Un pan de mur sonne creux.',
  'La bibliotheque secrete respire la poussiere et la cire. La roue de chiffrement avait sa place ici.',
  'Le mecanisme horloger est arrete. Si les engrenages repartent, une autre porte suivra.',
  'Le bureau du conservateur rassemble les preuves. Les connexions sont visibles, mais les mots manquent.',
  'Sur le toit, le telescope attend la bonne lentille. Le ciel donne une direction.',
  'La voute des reliquaires protege les objets manquants. Le sceau decide ce qui peut s ouvrir.',
  'Le tunnel porte les marques d eau et les secrets du batiment. Au fond, le sanctum resiste encore.',
  'Le sanctum est la derniere serrure. Le code Renaissance se lit dans la lumiere, pas dans les mots.',
];

const itemDescriptions = [
  'Medaille de laiton marquee d un soleil et d une rose. Elle s insere dans les mecanismes du sanctum.',
  'Roue de chiffrement en bois sombre et laiton, gravee de symboles abstraits.',
  'Cle ancienne a panneton triangulaire, prevue pour une niche de crypte.',
  'Petit miroir de bronze pour remettre certains signes dans le bon sens.',
  'Fragment de page ancien avec croquis et marques miroir, sans texte lisible.',
  'Tampon de sceau en bois et laiton, avec trace de cire bordeaux.',
  'Lentille ambree montee sur laiton, utile pour aligner le telescope et le rayon lunaire.',
  'Stylet d os a pointe de laiton, outil discret de dessin et de pression.',
  'Carte de parchemin pliee, tracee de lignes symboliques et de repères muets.',
  'Petit coffret reliquaire en noyer et laiton, ferme par une plaque solaire.',
];

const cinematicDefinitions = [
  {
    id: 'cine_intro_code_renaissance',
    name: 'Ouverture du code',
    slides: cinematicSlides.slice(0, 3),
    onEndType: 'scene',
    targetSceneId: 'scene_01_galerie_renaissance',
    narrations: [
      'La lettre arrive apres la fermeture du musee. Elle ne donne aucune reponse, seulement un lieu.',
      'Sous la cire, un fragment de codex et une medaille indiquent un chemin cache.',
      'Le mur pivote derriere la galerie. L enquete commence sous les salles publiques.',
    ],
  },
  {
    id: 'cine_final_manuscrit',
    name: 'Le manuscrit revele',
    slides: cinematicSlides.slice(3, 6),
    onEndType: 'none',
    targetSceneId: '',
    narrations: [
      'La lentille accroche le rayon de lune. Les petales de laiton s alignent sans bruit.',
      'Le piedestal s ouvre. Le manuscrit etait protege par la lumiere, pas par la force.',
      'A l aube, le musee se referme derriere toi. Le secret restera lisible seulement pour ceux qui savent regarder.',
    ],
  },
];

async function listSources() {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.png')) continue;
    const fullPath = path.join(sourceDir, entry.name);
    const stat = await fs.stat(fullPath);
    files.push({ fullPath, mtimeMs: stat.mtimeMs, name: entry.name });
  }
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return files;
}

function runPython(args) {
  const bundledPython = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
  const candidates = [
    process.env.PYTHON,
    existsSync(bundledPython) ? bundledPython : '',
    'py',
    'python',
  ].filter(Boolean);
  const failures = [];
  for (const command of candidates) {
    const finalArgs = command === 'py' ? ['-3', ...args] : args;
    const result = spawnSync(command, finalArgs, { encoding: 'utf8' });
    if (!result.error && result.status === 0) return;
    failures.push(`${command}: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  throw new Error(`No Python runner succeeded for chroma-key removal.\n${failures.join('\n')}`);
}

async function normalizeSceneOrCine(sourcePath, targetPath) {
  await sharp(sourcePath)
    .resize(sceneSize.width, sceneSize.height, { fit: 'cover', position: 'center' })
    .png()
    .toFile(targetPath);
}

async function normalizeItem(sourcePath, targetPath, sourceName) {
  const chromaSource = path.join(sourceCopyDir, sourceName);
  const alphaPath = path.join(alphaDir, sourceName);
  await fs.copyFile(sourcePath, chromaSource);
  runPython([
    helper,
    '--input', chromaSource,
    '--out', alphaPath,
    '--auto-key', 'border',
    '--soft-matte',
    '--transparent-threshold', '12',
    '--opaque-threshold', '220',
    '--despill',
  ]);
  await sharp(alphaPath)
    .resize(itemSize.width, itemSize.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(targetPath);
}

async function metadataFor(targetPath) {
  const meta = await sharp(targetPath).metadata();
  const stats = await fs.stat(targetPath);
  const { data, info } = await sharp(targetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaOffsets = [3, ((info.width - 1) * 4) + 3, ((info.height - 1) * info.width * 4) + 3, ((info.height * info.width - 1) * 4) + 3];
  const cornerAlpha = alphaOffsets.map((offset) => data[offset]);
  return {
    width: meta.width,
    height: meta.height,
    hasAlpha: Boolean(meta.hasAlpha),
    bytes: stats.size,
    transparentCorners: cornerAlpha.every((value) => value === 0),
  };
}

function makeChecker(width, height, cell = 24) {
  const channels = 4;
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const even = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const v = even ? 225 : 176;
      const idx = (y * width + x) * channels;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function makeContactSheet(assets, fileName, cols, thumbWidth, thumbHeight, checker = false) {
  const rows = Math.ceil(assets.length / cols);
  const width = cols * thumbWidth;
  const height = rows * thumbHeight;
  const base = checker
    ? await makeChecker(width, height, 24)
    : await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 20, g: 24, b: 28, alpha: 1 },
      },
    }).png().toBuffer();
  const composites = assets.map((asset, index) => ({
    input: path.join(outDir, asset.fileName),
    left: (index % cols) * thumbWidth,
    top: Math.floor(index / cols) * thumbHeight,
  }));
  const resized = [];
  for (const asset of assets) {
    resized.push(await sharp(path.join(outDir, asset.fileName))
      .resize(thumbWidth, thumbHeight, { fit: checker ? 'contain' : 'cover', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer());
  }
  const prepared = resized.map((input, index) => ({
    input,
    left: composites[index].left,
    top: composites[index].top,
  }));
  await sharp(base).composite(prepared).png().toFile(path.join(contactDir, fileName));
}

function asAssetEntry(asset, meta) {
  return {
    id: asset.id,
    name: asset.name,
    fileName: asset.fileName,
    path: `${publicBase}/${asset.fileName}`,
    width: meta.width,
    height: meta.height,
    hasAlpha: meta.hasAlpha,
    bytes: meta.bytes,
  };
}

function makeProject(manifest) {
  const actId = 'act_code_renaissance';
  return {
    id: 'project_code_renaissance_assets',
    title: 'Code Renaissance',
    description: 'Pack visuel realiste pour escape game de cryptographie Renaissance: scenes, objets alpha et deux cinematiques en trois images.',
    creationMode: 'expert',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    acts: [{ id: actId, name: 'Acte I - Le Code Renaissance' }],
    start: {
      type: 'cinematic',
      targetSceneId: 'scene_01_galerie_renaissance',
      targetCinematicId: 'cine_intro_code_renaissance',
    },
    items: manifest.items.map((item, index) => ({
      id: item.id,
      name: item.name,
      icon: items[index].icon,
      imageData: item.path,
      imageName: item.fileName,
      description: itemDescriptions[index],
    })),
    combinations: [],
    enigmas: [],
    cinematics: cinematicDefinitions.map((cinematic) => ({
      id: cinematic.id,
      name: cinematic.name,
      cinematicType: 'slides',
      slides: cinematic.slides.map((slide, index) => ({
        id: `slide_${slide.id}`,
        imageData: `${publicBase}/${slide.fileName}`,
        imageName: slide.fileName,
        narration: cinematic.narrations[index],
      })),
      steps: [],
      videoData: '',
      videoName: '',
      videoAutoplay: true,
      videoControls: true,
      onEndType: cinematic.onEndType,
      targetActId: '',
      targetSceneId: cinematic.targetSceneId,
      targetProjectId: '',
      targetProjectUserId: '',
      rewardItemId: '',
    })),
    scenes: manifest.scenes.map((scene, index) => ({
      id: scene.id,
      name: scene.name,
      actId,
      parentSceneId: index === 0 ? '' : manifest.scenes[Math.max(0, index - 1)].id,
      backgroundData: scene.path,
      backgroundName: scene.fileName,
      backgroundWidth: scene.width,
      backgroundHeight: scene.height,
      backgroundAspectRatio: scene.width / scene.height,
      visualEffect: index >= 6 ? 'vignette' : 'none',
      visualEffectIntensity: 'subtle',
      sceneTransition: 'fade',
      sceneTransitionDuration: 850,
      introText: intros[index],
      hotspots: [],
      sceneObjects: [],
    })),
    map: {
      rows: 16,
      cols: 24,
      cells: [],
      rooms: [],
      connections: [],
      canvases: [{ id: 'route_canvas_1', name: 'Canvas 1' }],
    },
    characterModels3d: [],
    decorModels3d: [],
  };
}

async function main() {
  if (!existsSync(sourceDir)) throw new Error(`Missing source dir: ${sourceDir}`);
  if (!existsSync(helper)) throw new Error(`Missing chroma helper: ${helper}`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(sourceCopyDir, { recursive: true });
  await fs.mkdir(alphaDir, { recursive: true });
  await fs.mkdir(contactDir, { recursive: true });

  const sources = await listSources();
  const selected = [...scenes, ...items, ...cinematicSlides];
  const sourceLookup = new Map(sources.map((source, index) => [index + 1, source.fullPath]));
  const outputMeta = new Map();

  for (const asset of selected) {
    const sourcePath = sourceLookup.get(asset.sourceIndex);
    if (!sourcePath) throw new Error(`Missing source index ${asset.sourceIndex} for ${asset.fileName}`);
    const targetPath = path.join(outDir, asset.fileName);
    if (asset.type === 'item') {
      await normalizeItem(sourcePath, targetPath, asset.fileName.replace('.png', '-source.png'));
    } else {
      await normalizeSceneOrCine(sourcePath, targetPath);
    }
    outputMeta.set(asset.fileName, await metadataFor(targetPath));
  }

  const manifest = {
    slug: 'renaissance-code',
    title: 'Code Renaissance',
    description: 'Pack realiste et coherent inspire par les codes de Leonard, les musees nocturnes et les mecanismes Renaissance.',
    generatedWith: 'Built-in image_gen, then local chroma-key alpha removal for inventory objects.',
    publicBase,
    sizes: {
      scenes: sceneSize,
      cinematics: sceneSize,
      items: itemSize,
    },
    scenes: scenes.map((asset) => asAssetEntry(asset, outputMeta.get(asset.fileName))),
    items: items.map((asset) => {
      const entry = asAssetEntry(asset, outputMeta.get(asset.fileName));
      return { ...entry, transparentCorners: outputMeta.get(asset.fileName).transparentCorners };
    }),
    cinematics: cinematicDefinitions.map((cinematic) => ({
      id: cinematic.id,
      name: cinematic.name,
      slides: cinematic.slides.map((slide) => asAssetEntry(slide, outputMeta.get(slide.fileName))),
    })),
    rejectedSources: [
      {
        sourceIndex: 31,
        reason: 'Regenerated because the first final dawn frame resembled a recognizable real museum courtyard.',
      },
    ],
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outDir, 'renaissance-code-project.json'), `${JSON.stringify(makeProject(manifest), null, 2)}\n`, 'utf8');
  await makeContactSheet(scenes, 'scenes-contact.png', 5, 334, 188);
  await makeContactSheet(items, 'items-contact.png', 5, 180, 180, true);
  await makeContactSheet(cinematicSlides, 'cinematics-contact.png', 3, 334, 188);

  const validation = {
    outputDir: outDir,
    sourceDir,
    counts: {
      scenes: manifest.scenes.length,
      items: manifest.items.length,
      cinematicSlides: manifest.cinematics.reduce((total, cinematic) => total + cinematic.slides.length, 0),
      cinematics: manifest.cinematics.length,
    },
    itemsHaveAlpha: manifest.items.every((item) => item.hasAlpha && item.transparentCorners),
    allSceneSizesOk: manifest.scenes.every((scene) => scene.width === sceneSize.width && scene.height === sceneSize.height),
    allCinematicSizesOk: manifest.cinematics.every((cinematic) => cinematic.slides.every((slide) => slide.width === sceneSize.width && slide.height === sceneSize.height)),
    allItemSizesOk: manifest.items.every((item) => item.width === itemSize.width && item.height === itemSize.height),
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(outDir, 'validation-report.json'), `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(validation, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

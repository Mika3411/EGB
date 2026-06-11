import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'generated', 'caribbean-treasure');
const META_DIR = path.join(ROOT, 'tmp', 'caribbean-treasure', 'ai-generation');
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

const style = [
  'Realistic cinematic escape-game asset, cohesive Caribbean treasure hunt style.',
  'Moonlit tropical island, turquoise sea, warm lantern light, weathered wood, brass, coral, salt, humid air.',
  'Wide-angle composition for a point-and-click game, clear interactive surfaces, crisp silhouettes, readable midtones.',
  'No text, no subtitles, no UI, no watermark, no modern objects, no logos.',
].join(' ');

const scenic = (name, prompt, group = 'scenes') => ({
  type: 'scene',
  group,
  name,
  fileName: name,
  size: process.env.OPENAI_IMAGE_SIZE || '1536x1024',
  prompt: `${style}\nScene requirement: ${prompt}\nKeep all doors, passages, props, and clue supports in stable visible positions. Do not show inventory reward items as loose pickups unless the scene clue requires a support object.`,
});

const item = (name, prompt) => ({
  type: 'item',
  group: 'items',
  name,
  fileName: name,
  size: '1024x1024',
  prompt: [
    'Realistic isolated inventory prop for a Caribbean treasure hunt escape game.',
    prompt,
    'Single object centered, fully visible, PNG with transparent alpha background.',
    'No table, no room, no floor, no label, no text, no cast shadow background, no border, no watermark.',
  ].join(' '),
});

const assets = [
  scenic('scene-anse_contrebandiers.png', 'Smugglers cove at night. Foreground left: weathered pier with rope crates under it. Right side: open blue tavern doorway with warm light. Middle distance: open sandy street toward spice market canopies. Left-middle: beach path with coconut palms. Far water: a shipwreck visible beyond reef.'),
  scenic('scene-taverne_pelican_bleu.png', 'Interior of the Blue Pelican tavern, warm lanterns, rough wood. Lower left: iron-banded chest on a table. Center-right: Mateo the fisherman seated at the bar, visible but not close-up. Left doorway open back to cove. Far right locked stone-and-wood door with small brass lion plate toward the fort. Another side doorway toward market.'),
  scenic('scene-marche_epices.png', 'Night spice market under red and ochre canvas awnings. Left edge has open route back to cove/tavern. Right edge has lit doorway to cartographer workshop. Foreground: crate of sugar with eight copper nails, red pepper bowl, small copper lion figurine on a stall.'),
  scenic('scene-atelier_cartographe.png', 'Cartographer workshop, lamplight, parchment maps, inkwells. Center: broad table for reassembling a torn letter with wax and thread, no loose key visible. Left doorway back to market. Right doorway opens to a descending path toward a flooded chapel.'),
  scenic('scene-plage_cocotiers.png', 'Moonlit coconut beach with several paths. Left path returns to cove; left rear trail goes to corsair cemetery. Right side: fisherman hut and lighthouse path visible. Center foreground: rocky tidal pass partly flooded, dangerous without compass. Lower sand: two tide marks carved in rock and a patch of golden yellow sand.'),
  scenic('scene-cabane_pecheur.png', 'Fisherman hut interior facing the beach, open door left showing beach moonlight, right opening toward lighthouse path. Center: hanging fishing net with hooks and small metal tools, but no obvious compass ring. On wall: simple fisherman reef sketch with east-side gap.'),
  scenic('scene-phare_pointe.png', 'Lighthouse on a rocky point at night, readable wide shot. Central lighthouse with glowing third lantern and small weather vane. Left path descends to beach, right path toward fisherman hut. A white sheet pinned by four clips dries in the wind near the lower right. Shipwreck faintly visible in the light beam.'),
  scenic('scene-cimetiere_corsaires.png', 'Corsair cemetery by the sea, moonlit tombstones and palms. Left path to beach, central ruined chapel porch visible, right trail into dark mangrove blocked by water. Foreground: Rivas grave circled by six shells, and a skull below the north point of a tall marker.'),
  scenic('scene-chapelle_engloutie.png', 'Flooded colonial chapel, ankle-deep seawater, moonlight through broken roof. Left exit toward cemetery, right archway toward cartographer path. Center: white shell lying in exact center of submerged aisle. High above: cracked bell split into two clear lips.'),
  scenic('scene-mangrove_lucioles.png', 'Mangrove of fireflies, shallow black water, twisted roots. Left trail returns to cemetery, right gap leads to a sea cave. Fireflies form a clear diagonal rising from southwest foreground to north background. A concentrated green glow hangs near right-middle roots.'),
  scenic('scene-grotte_ressac.png', 'Sea cave with surf echoes. Left opening back to beach, right side passage toward mangrove. Center-left: blue-water channel leading toward shipwreck, partly hidden by reef rocks. Right-middle: closed coral door in the rock, cold and dark, with a small recess for an amulet.'),
  scenic('scene-fortin_espagnol.png', 'Small Spanish fort courtyard at night, damp stone, warm sconces. Left arch returns to tavern. Center: locked governor door with brass lion lock plate. Rusted cannons aim toward the sea and shipwreck. The courtyard is small but readable.'),
  scenic('scene-chambre_gouverneur.png', 'Governor bedroom inside fort, dusty but intact. Left doorway back to fort courtyard. Center: red-draped bed with bedding lifted enough to reveal a hidden map compartment, but no amulet visible. Left window looks toward shipwreck. Papers and Spanish colonial furniture around the room.'),
  scenic('scene-epave_santa_agueda.png', 'Shipwreck of the Santa Agueda on a reef under moonlight. Left water channel returns to sea cave. Central broken deck and collapsed hold. Right-lower hatch blocked by blue cordage. Far distance: fort silhouette watches the wreck.'),
  scenic('scene-caverne_tresor.png', 'Treasure cave beyond coral door, not just a pile of gold: an immense stone lock. Left opening back to sea cave. Center: four coral stones set into a low altar, unlit red, yellow, green, blue positions. Lower right: sealed treasure chests half buried. Back wall hints at sea behind rock.'),
  scenic('puzzle-carte-recif.png', 'Top-down antique parchment map of a Caribbean reef. No readable words. Clear blue channel crosses a 3 by 3 tile grid; landmarks include a white shell in the center, a skull below the north point, an east reef opening, and a southwest-to-north diagonal firefly route. The art must work as an image puzzle.', 'puzzles'),
  scenic('cine-intro-01-goelette.png', 'Cinematic slide: a small schooner leaving a moonlit Caribbean island cove before dawn, seen from the dock, treasure-hunt mood, no text.', 'cinematics'),
  scenic('cine-intro-02-carte.png', 'Cinematic slide: close view of an old salt-stained treasure map in a traveler hand above lantern light, the map shows routes and mistakes but contains no readable text.', 'cinematics'),
  scenic('cine-intro-03-anse.png', 'Cinematic slide: first step onto the wooden pier of the smugglers cove, three visible paths splitting toward tavern, market, and beach, moonlit water behind.', 'cinematics'),
  scenic('cine-final-01-pierres.png', 'Cinematic slide: four coral stones in the treasure cave glow red, yellow, green, and blue as seawater recedes behind the altar.', 'cinematics'),
  scenic('cine-final-02-coffres.png', 'Cinematic slide: sealed treasure chests emerging from wet sand in the cave, gold light escaping through cracks, realistic dramatic composition.', 'cinematics'),
  scenic('cine-final-03-depart.png', 'Cinematic slide: the explorer leaves the cave before the tide returns, dawn on the Caribbean water and the island closing behind, no close-up face.', 'cinematics'),
  item('item-cercle-boussole-fendu.png', 'A cracked brass compass ring, missing the dial and needle, with clear north and south marks, salt stains and green patina.'),
  item('item-aiguille-aimantee.png', 'A long magnetized compass needle stuck to a tiny old anchor hook, red and silver metal tip, salt worn.'),
  item('item-boussole-reparee.png', 'A repaired brass compass assembled from a cracked ring and needle, imperfect but working, turquoise glass and patina.'),
  item('item-lettre-dechiree.png', 'Four torn pieces of salt-stained old paper arranged as a fragmented letter, ragged edges, wax flecks, no readable words.'),
  item('item-clef-cuivre.png', 'An old copper key with verdigris and a small Spanish lion shape on the bit, weathered by sea air.'),
  item('item-amulette-corail.png', 'A black coral amulet set in copper, warm dark red undertones, small loop, ancient Caribbean pirate relic.'),
];

const groups = new Map();
for (const asset of assets) {
  if (!groups.has(asset.group)) groups.set(asset.group, []);
  groups.get(asset.group).push(asset);
}
groups.set('scenes-a', assets.filter((asset) => asset.group === 'scenes').slice(0, 5));
groups.set('scenes-b', assets.filter((asset) => asset.group === 'scenes').slice(5, 10));
groups.set('scenes-c', assets.filter((asset) => asset.group === 'scenes').slice(10));
groups.set('all', assets);

const requested = process.argv.slice(2);
const selected = requested.length
  ? requested.flatMap((key) => groups.get(key) || assets.filter((asset) => asset.fileName === key))
  : assets;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openaiImage(asset, attempt = 1) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const body = {
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt: asset.prompt,
    size: asset.size,
    quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
    n: 1,
  };
  if (asset.type === 'item') {
    body.background = 'transparent';
    body.output_format = 'png';
  }
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    if (attempt < 3 && [408, 429, 500, 502, 503, 504].includes(response.status)) {
      await sleep(2000 * attempt);
      return openaiImage(asset, attempt + 1);
    }
    throw new Error(`${asset.fileName}: OpenAI ${response.status} ${payload?.error?.message || text}`);
  }
  const image = payload.data?.[0] || {};
  if (image.b64_json) return Buffer.from(image.b64_json, 'base64');
  if (image.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) throw new Error(`${asset.fileName}: image URL ${imageResponse.status}`);
    return Buffer.from(await imageResponse.arrayBuffer());
  }
  throw new Error(`${asset.fileName}: no image data returned`);
}

async function normalizeImage(asset, inputBuffer) {
  if (asset.type === 'item') {
    return sharp(inputBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }
  return sharp(inputBuffer)
    .resize(W, H, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();
}

async function generate(asset) {
  const raw = await openaiImage(asset);
  const finalBuffer = await normalizeImage(asset, raw);
  const target = path.join(OUT_DIR, asset.fileName);
  await fs.writeFile(target, finalBuffer);
  const meta = await sharp(finalBuffer).metadata();
  await fs.writeFile(
    path.join(META_DIR, `${asset.fileName}.json`),
    `${JSON.stringify({
      fileName: asset.fileName,
      group: asset.group,
      type: asset.type,
      prompt: asset.prompt,
      width: meta.width,
      height: meta.height,
      hasAlpha: Boolean(meta.hasAlpha),
      generatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    'utf8',
  );
  console.log(`${asset.fileName} ${meta.width}x${meta.height} alpha=${Boolean(meta.hasAlpha)}`);
}

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.mkdir(META_DIR, { recursive: true });

if (!selected.length) {
  console.error(`No assets selected for ${requested.join(', ')}`);
  process.exit(1);
}

for (const asset of selected) {
  await generate(asset);
}

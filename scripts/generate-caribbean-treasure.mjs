import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'generated', 'caribbean-treasure');
const PUBLIC = '/assets/generated/caribbean-treasure';
const W = 1672;
const H = 941;

const asset = (name) => `${PUBLIC}/${name}`;
const file = (name) => path.join(OUT_DIR, name);

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mulberry(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(seed = 1, opacity = 0.12) {
  return `
  <filter id="grain-${seed}" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="4" seed="${seed}" />
    <feColorMatrix type="saturate" values="0.2" />
    <feComponentTransfer><feFuncA type="table" tableValues="0 ${opacity}" /></feComponentTransfer>
  </filter>`;
}

function sceneSvg(scene) {
  const rand = mulberry(scene.seed || 1);
  const stars = Array.from({ length: 70 }, () => {
    const x = Math.round(rand() * W);
    const y = Math.round(rand() * 390);
    const r = (rand() * 1.8 + 0.4).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#f7e7b1" opacity="${(0.18 + rand() * 0.38).toFixed(2)}"/>`;
  }).join('');
  const palms = Array.from({ length: 5 }, (_, i) => {
    const x = 80 + i * 360 + rand() * 80;
    const y = 575 + rand() * 120;
    return `<g opacity="0.72" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(-10 + rand() * 20).toFixed(1)})">
      <path d="M0 170 C20 95 11 42 38 0" stroke="#432a22" stroke-width="18" fill="none" stroke-linecap="round"/>
      <path d="M38 0 C-20 24 -75 38 -105 76 C-45 66 5 43 38 0Z" fill="#174f3d"/>
      <path d="M38 0 C14 -18 -50 -50 -100 -47 C-46 -22 -8 -5 38 0Z" fill="#1c6c50"/>
      <path d="M38 0 C78 20 124 44 148 90 C91 72 57 41 38 0Z" fill="#176347"/>
      <path d="M38 0 C64 -18 121 -44 160 -35 C105 -16 71 2 38 0Z" fill="#1f7654"/>
    </g>`;
  }).join('');
  const passages = (scene.passages || []).map((p) => {
    const glow = p.open ? '#e9a94a' : '#29405b';
    const shade = p.open ? '#1b2630' : '#0d1724';
    return `<g opacity="0.96">
      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8" fill="${shade}" stroke="${glow}" stroke-width="7"/>
      ${p.open ? `<path d="M${p.x + p.w * 0.18} ${p.y + p.h * 0.15} L${p.x + p.w * 0.78} ${p.y + p.h * 0.26} L${p.x + p.w * 0.78} ${p.y + p.h * 0.9} L${p.x + p.w * 0.18} ${p.y + p.h * 0.78}Z" fill="#3b281d" opacity="0.72"/>` : `<path d="M${p.x + p.w * 0.2} ${p.y + p.h * 0.5} H${p.x + p.w * 0.8}" stroke="#9bb7ca" stroke-width="9" opacity="0.6"/>`}
      ${p.hint ? `<circle cx="${p.x + p.w * 0.72}" cy="${p.y + p.h * 0.55}" r="10" fill="#f5c15e"/>` : ''}
    </g>`;
  }).join('');
  const lanterns = (scene.lanterns || [[140, 620], [1490, 570]]).map(([x, y]) => `
    <g>
      <ellipse cx="${x}" cy="${y + 42}" rx="98" ry="46" fill="#f3a84a" opacity="0.13"/>
      <rect x="${x - 18}" y="${y - 22}" width="36" height="54" rx="8" fill="#3c2b23" stroke="#d7943d" stroke-width="5"/>
      <circle cx="${x}" cy="${y + 5}" r="18" fill="#ffd36d"/>
    </g>`).join('');
  const elements = (scene.elements || []).join('');
  const title = scene.title ? `<text x="64" y="90" font-family="Georgia, serif" font-size="42" fill="#f5e5bd" opacity="0.18">${esc(scene.title)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08192b"/><stop offset="0.54" stop-color="#123a4e"/><stop offset="1" stop-color="#0b5d69"/></linearGradient>
      <linearGradient id="sand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b88752"/><stop offset="0.55" stop-color="#d2aa70"/><stop offset="1" stop-color="#75513c"/></linearGradient>
      <radialGradient id="moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff4c8"/><stop offset="0.45" stop-color="#f7d98d"/><stop offset="1" stop-color="#f7d98d" stop-opacity="0"/></radialGradient>
      ${texture(scene.seed || 1, 0.16)}
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="${scene.moonX || 1330}" cy="${scene.moonY || 135}" r="150" fill="url(#moon)" opacity="0.48"/>
    ${stars}
    <path d="M0 536 C210 506 400 552 618 526 C820 504 994 533 1210 512 C1395 494 1532 512 1672 493 L1672 941 L0 941Z" fill="#0f7775"/>
    <path d="M0 612 C180 579 347 622 536 604 C760 582 884 626 1126 600 C1364 576 1498 605 1672 584 L1672 941 L0 941Z" fill="url(#sand)"/>
    <path d="M0 610 C255 650 411 634 590 660 C859 701 1050 626 1270 671 C1438 703 1562 672 1672 692 L1672 941 L0 941Z" fill="#2f705e" opacity="0.28"/>
    ${palms}
    ${scene.structure || ''}
    ${passages}
    ${elements}
    ${lanterns}
    <rect width="${W}" height="${H}" fill="#000" filter="url(#grain-${scene.seed || 1})" opacity="0.8"/>
    <rect width="${W}" height="${H}" fill="none" stroke="#103143" stroke-width="18" opacity="0.55"/>
    ${title}
  </svg>`;
}

function itemSvg(item) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <filter id="soft"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#0a1820" flood-opacity="0.35"/></filter>
      <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3a0"/><stop offset="0.45" stop-color="#b7792e"/><stop offset="1" stop-color="#5f3518"/></linearGradient>
      <linearGradient id="coral" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff795a"/><stop offset="1" stop-color="#691f34"/></linearGradient>
    </defs>
    <g filter="url(#soft)">${item.shape}</g>
  </svg>`;
}

function puzzleSvg() {
  const grid = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const x = 300 + c * 220;
      const y = 178 + r * 170;
      grid.push(`<rect x="${x}" y="${y}" width="220" height="170" fill="none" stroke="#5b3826" stroke-width="8" opacity="0.45"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${texture(88, 0.22)}</defs>
    <rect width="${W}" height="${H}" fill="#c99b61"/>
    <path d="M240 116 C420 60 860 58 1160 110 C1320 139 1400 233 1395 410 C1387 662 1172 790 858 815 C548 839 282 718 230 510 C195 368 146 186 240 116Z" fill="#e5c489" stroke="#6b432c" stroke-width="18"/>
    <path d="M380 520 C515 374 706 390 834 452 C965 516 1050 465 1188 326" fill="none" stroke="#1e777b" stroke-width="24" stroke-linecap="round" opacity="0.78"/>
    <path d="M448 640 C590 610 711 572 782 502 C858 426 1004 438 1130 492" fill="none" stroke="#0e5162" stroke-width="15" stroke-dasharray="28 22" opacity="0.72"/>
    <g fill="#5e3428">
      <path d="M724 396 l38 72 l-78 -20 l72 -38 l-20 78Z"/>
      <circle cx="1188" cy="326" r="32"/>
      <path d="M364 706 c34 -44 88 -48 122 0 c-48 -16 -82 -16 -122 0Z"/>
    </g>
    <g stroke="#6b432c" stroke-width="10" fill="none" opacity="0.7">
      <path d="M588 258 c50 -48 142 -48 196 0"/>
      <path d="M1000 690 c-84 -30 -164 -20 -236 30"/>
    </g>
    ${grid.join('')}
    <path d="M260 120 L1390 790" stroke="#6b432c" stroke-width="7" opacity="0.28"/>
    <path d="M1390 120 L260 790" stroke="#6b432c" stroke-width="7" opacity="0.22"/>
    <rect width="${W}" height="${H}" fill="#000" filter="url(#grain-88)" opacity="0.8"/>
  </svg>`;
}

const items = [
  {
    id: 'item_cercle_boussole_fendu',
    name: 'Cercle de boussole fendu',
    icon: 'compass',
    imageName: 'item-cercle-boussole-fendu.png',
    description: 'Un anneau de laiton fendu. Le cadran manque, mais les marques nord et sud sont encore nettes.',
    shape: '<circle cx="256" cy="256" r="136" fill="none" stroke="url(#brass)" stroke-width="44"/><path d="M256 80 v58 M256 374 v58 M80 256 h58 M374 256 h58" stroke="#ffe5a1" stroke-width="20" stroke-linecap="round"/><path d="M336 118 C280 146 241 197 214 276" fill="none" stroke="#301b13" stroke-width="18" stroke-linecap="round"/>',
  },
  {
    id: 'item_aiguille_aimantee',
    name: 'Aiguille aimantée',
    icon: 'needle',
    imageName: 'item-aiguille-aimantee.png',
    description: 'Une aiguille longue, aimantée contre une ancre miniature. Elle frémit près du cercle de boussole.',
    shape: '<path d="M92 292 L418 176 L298 310 L392 364 Z" fill="#d7edf0" stroke="#29404a" stroke-width="12"/><path d="M92 292 L298 310 L220 344 Z" fill="#d54638"/><circle cx="260" cy="282" r="34" fill="url(#brass)" stroke="#402616" stroke-width="10"/>',
  },
  {
    id: 'item_boussole_reparee',
    name: 'Boussole réparée',
    icon: 'compass',
    imageName: 'item-boussole-reparee.png',
    description: 'La boussole tient mal dans la main, mais elle pointe vers les passages noyés quand la mer se retire.',
    shape: '<circle cx="256" cy="256" r="160" fill="url(#brass)" stroke="#412615" stroke-width="16"/><circle cx="256" cy="256" r="104" fill="#0b5d69" stroke="#ffe0a0" stroke-width="12"/><path d="M256 111 L294 255 L256 401 L218 255Z" fill="#f7e2a0"/><path d="M256 111 L294 255 L256 246 Z" fill="#cf3e34"/><circle cx="256" cy="256" r="21" fill="#2b1a12"/>',
  },
  {
    id: 'item_lettre_dechiree',
    name: 'Lettre déchirée',
    icon: 'letter',
    imageName: 'item-lettre-dechiree.png',
    description: 'Quatre morceaux de papier salé. Les fibres se recollent mieux quand on suit l’ordre des lieux.',
    shape: '<path d="M112 112 L244 82 L230 244 L98 270Z" fill="#ead0a0" stroke="#705238" stroke-width="8"/><path d="M266 94 L412 130 L382 250 L250 235Z" fill="#f0d9ac" stroke="#705238" stroke-width="8"/><path d="M118 292 L244 250 L270 398 L104 412Z" fill="#e6c895" stroke="#705238" stroke-width="8"/><path d="M282 260 L420 280 L390 420 L256 392Z" fill="#f2dcad" stroke="#705238" stroke-width="8"/><g stroke="#67452d" stroke-width="8" opacity="0.55"><path d="M132 170 h88"/><path d="M292 164 h70"/><path d="M138 354 h96"/><path d="M296 336 h82"/></g>',
  },
  {
    id: 'item_clef_cuivre',
    name: 'Clef de cuivre salée',
    icon: 'key',
    imageName: 'item-clef-cuivre.png',
    description: 'Une clef piquée de vert-de-gris. Le panneton porte un lion espagnol à peine visible.',
    shape: '<circle cx="168" cy="238" r="70" fill="none" stroke="url(#brass)" stroke-width="34"/><path d="M230 238 H438" stroke="url(#brass)" stroke-width="42" stroke-linecap="round"/><path d="M370 238 v78 M424 238 v52" stroke="#6a3d1b" stroke-width="32" stroke-linecap="round"/><circle cx="168" cy="238" r="24" fill="#14384a"/>',
  },
  {
    id: 'item_amulette_corail',
    name: 'Amulette de corail noir',
    icon: 'gem',
    imageName: 'item-amulette-corail.png',
    description: 'Un corail sombre cerclé de cuivre. Il devient tiède près des portes taillées dans la roche.',
    shape: '<path d="M256 66 C330 134 394 200 386 290 C378 386 318 452 256 472 C194 452 134 386 126 290 C118 200 182 134 256 66Z" fill="url(#coral)" stroke="#2b1b1c" stroke-width="16"/><path d="M256 128 C288 176 318 226 314 286 C309 352 287 390 256 412 C225 390 203 352 198 286 C194 226 224 176 256 128Z" fill="#17141b" opacity="0.78"/><circle cx="256" cy="102" r="34" fill="none" stroke="url(#brass)" stroke-width="16"/>',
  },
];

items.forEach((item) => {
  item.imageData = asset(item.imageName);
});

const scenesArt = [
  ['scene_anse_contrebandiers', 'Anse des contrebandiers', 11, '<path d="M90 685 L480 590 L626 632 L278 770Z" fill="#5d3924" stroke="#c68a4e" stroke-width="10"/><path d="M1240 472 q180 -92 318 12 v64 q-140 -68 -318 12Z" fill="#2e1d18" stroke="#b98345" stroke-width="8"/><path d="M1285 440 l72 -170 l62 184" stroke="#d6b887" stroke-width="8" fill="none"/><path d="M1348 275 q84 38 144 112 q-108 8 -184 -20Z" fill="#e8d6af" opacity="0.78"/>', [{ x: 1380, y: 502, w: 180, h: 210, open: true }, { x: 612, y: 562, w: 142, h: 168, open: true }], [[140, 610], [780, 595]]],
  ['scene_taverne_pelican_bleu', 'Taverne du Pélican Bleu', 12, '<rect x="138" y="270" width="1140" height="470" rx="22" fill="#4b2b1e" stroke="#b97f3a" stroke-width="16"/><path d="M112 290 L700 170 L1310 290 Z" fill="#7b3f24" stroke="#d5a15d" stroke-width="14"/><rect x="850" y="430" width="210" height="188" fill="#1b2830" stroke="#d99b4a" stroke-width="10"/><circle cx="955" cy="520" r="36" fill="#1c6170"/><rect x="290" y="530" width="250" height="110" rx="12" fill="#2b1a14" stroke="#c18b4b" stroke-width="10"/>', [{ x: 94, y: 512, w: 140, h: 210, open: true }, { x: 1208, y: 470, w: 130, h: 222, open: false, hint: true }], [[300, 420], [1110, 400]]],
  ['scene_marche_epices', 'Marché aux épices', 13, '<path d="M160 430 L520 270 L890 430Z" fill="#be4b36"/><path d="M720 420 L1040 292 L1390 420Z" fill="#e0a744"/><rect x="245" y="434" width="1150" height="245" fill="#6b3d2a" stroke="#c9914d" stroke-width="12"/><circle cx="390" cy="576" r="70" fill="#b62d2e"/><circle cx="548" cy="590" r="70" fill="#d7b14d"/><circle cx="704" cy="579" r="70" fill="#225b45"/><path d="M1150 520 l74 -48 l74 48 l-22 86 h-104Z" fill="#8a5b35" stroke="#e0c187" stroke-width="8"/>', [{ x: 84, y: 510, w: 128, h: 196, open: true }, { x: 1370, y: 498, w: 130, h: 204, open: true }], [[250, 480], [1280, 478]]],
  ['scene_atelier_cartographe', 'Atelier du cartographe', 14, '<rect x="168" y="246" width="1180" height="520" rx="18" fill="#513323" stroke="#c99253" stroke-width="16"/><rect x="355" y="350" width="650" height="310" rx="12" fill="#b88752" stroke="#5f3c27" stroke-width="12"/><path d="M386 384 C526 340 714 380 888 344 C942 420 908 554 982 626 C726 594 554 640 386 608Z" fill="#dfbe84" stroke="#6d452c" stroke-width="9"/><g stroke="#6d452c" stroke-width="7" opacity="0.56"><path d="M450 450 C590 520 680 420 830 500"/><path d="M532 590 C650 520 800 600 920 540"/></g>', [{ x: 128, y: 512, w: 132, h: 205, open: true }, { x: 1230, y: 456, w: 142, h: 230, open: true }], [[260, 450], [1120, 420]]],
  ['scene_plage_cocotiers', 'Plage aux cocotiers', 15, '<path d="M190 675 C420 578 600 648 754 566 C880 500 1058 560 1270 506 C1196 620 1050 700 842 710 C560 724 348 706 190 675Z" fill="#d9b576" opacity="0.92"/><path d="M1010 660 l180 -120 l230 58 l-86 128Z" fill="#6a3d2b" stroke="#dba75d" stroke-width="9"/><path d="M1118 550 q88 -120 205 -170" stroke="#4d2e20" stroke-width="16" fill="none"/><path d="M1324 380 q-120 14 -204 72 q98 -2 204 -72Z" fill="#1b7653"/>', [{ x: 76, y: 526, w: 120, h: 194, open: true }, { x: 1414, y: 506, w: 130, h: 204, open: true }], [[290, 600], [1270, 570]]],
  ['scene_cabane_pecheur', 'Cabane du pêcheur', 16, '<rect x="250" y="300" width="910" height="430" rx="20" fill="#5a3424" stroke="#c78f4d" stroke-width="14"/><path d="M218 312 L695 170 L1195 312Z" fill="#276052" stroke="#cca05b" stroke-width="12"/><path d="M350 548 C488 486 640 528 804 500 C880 488 952 512 1032 484" fill="none" stroke="#d6c69a" stroke-width="18" opacity="0.72"/><path d="M738 438 l90 64 l-120 40Z" fill="#bccad0" stroke="#344850" stroke-width="7"/>', [{ x: 100, y: 548, w: 134, h: 196, open: true }, { x: 1100, y: 512, w: 126, h: 204, open: true }], [[315, 430], [1030, 420]]],
  ['scene_phare_pointe', 'Phare de la Pointe', 17, '<path d="M735 172 h230 l70 600 h-370Z" fill="#d9d0b5" stroke="#6b4a35" stroke-width="16"/><path d="M700 196 h300 l-52 -72 h-196Z" fill="#7b3524" stroke="#e0b06c" stroke-width="12"/><rect x="770" y="250" width="190" height="120" rx="14" fill="#f3c15e" opacity="0.82"/><path d="M0 740 C300 620 498 650 670 602 C892 540 1108 648 1672 560 V941 H0Z" fill="#78604e" opacity="0.75"/>', [{ x: 92, y: 620, w: 128, h: 188, open: true }, { x: 1370, y: 590, w: 128, h: 190, open: true }], [[820, 370], [1450, 600]]],
  ['scene_cimetiere_corsaires', 'Cimetière des corsaires', 18, '<g fill="#9d9a87" stroke="#3c3a31" stroke-width="8"><path d="M320 640 v-110 q0 -60 60 -60 q60 0 60 60 v110Z"/><path d="M620 690 v-120 q0 -52 52 -52 q52 0 52 52 v120Z"/><path d="M1010 650 v-116 q0 -58 58 -58 q58 0 58 58 v116Z"/></g><path d="M740 520 l90 -92 l90 92 l-38 104 h-144Z" fill="#6b5847" stroke="#d4b274" stroke-width="9"/><path d="M1210 520 C1300 430 1414 426 1512 510 C1400 498 1300 520 1210 520Z" fill="#174f3d"/>', [{ x: 92, y: 580, w: 126, h: 196, open: true }, { x: 1396, y: 510, w: 126, h: 204, open: false, hint: true }, { x: 780, y: 452, w: 116, h: 158, open: true }], [[250, 560], [1130, 540]]],
  ['scene_chapelle_engloutie', 'Chapelle engloutie', 19, '<path d="M320 230 h860 l80 520 h-980Z" fill="#65716d" stroke="#c2b083" stroke-width="15"/><path d="M520 230 l300 -118 l300 118Z" fill="#445b58" stroke="#d7be7e" stroke-width="12"/><circle cx="810" cy="390" r="120" fill="#123a4e" stroke="#d1b66e" stroke-width="14"/><path d="M810 275 V505 M700 390 H920" stroke="#f1c55d" stroke-width="22" opacity="0.65"/><path d="M250 720 C520 664 800 738 1228 682 V941 H250Z" fill="#0e7580" opacity="0.38"/>', [{ x: 118, y: 600, w: 128, h: 188, open: true }, { x: 1260, y: 580, w: 132, h: 196, open: true }], [[430, 520], [1180, 560]]],
  ['scene_mangrove_lucioles', 'Mangrove des lucioles', 20, '<g stroke="#4b2d20" stroke-width="18" fill="none" opacity="0.9"><path d="M170 780 C260 606 262 430 340 230"/><path d="M580 796 C630 620 550 462 650 248"/><path d="M1130 790 C1040 612 1128 442 1030 234"/><path d="M1450 760 C1360 622 1390 480 1320 300"/></g><g fill="#b7fb83" opacity="0.8"><circle cx="402" cy="380" r="9"/><circle cx="770" cy="456" r="8"/><circle cx="1024" cy="365" r="10"/><circle cx="1240" cy="554" r="8"/><circle cx="610" cy="590" r="7"/></g><path d="M360 676 C568 570 812 650 1020 560 C1162 500 1300 530 1460 470" stroke="#0e3033" stroke-width="54" fill="none" opacity="0.75"/>', [{ x: 80, y: 586, w: 130, h: 196, open: true }, { x: 1410, y: 500, w: 126, h: 210, open: true }], [[420, 520], [1260, 505]]],
  ['scene_grotte_ressac', 'Grotte du ressac', 21, '<path d="M90 768 C170 420 444 230 828 220 C1220 210 1508 436 1588 764 L1480 941 H180Z" fill="#263746" stroke="#98a2a2" stroke-width="20"/><path d="M430 740 C522 538 668 460 834 462 C1014 464 1156 560 1248 740Z" fill="#071a24"/><path d="M460 788 C610 710 760 770 900 718 C1064 658 1190 742 1340 696" stroke="#2cb1aa" stroke-width="42" fill="none" opacity="0.58"/>', [{ x: 90, y: 624, w: 126, h: 198, open: true }, { x: 1326, y: 610, w: 134, h: 198, open: false, hint: true }, { x: 760, y: 470, w: 180, h: 250, open: false, hint: true }], [[305, 650], [1310, 620]]],
  ['scene_fortin_espagnol', 'Fortin espagnol', 22, '<rect x="255" y="252" width="1120" height="500" rx="16" fill="#76624d" stroke="#cfad75" stroke-width="16"/><path d="M260 252 h180 v-80 h130 v80 h220 v-80 h130 v80 h220 v-80 h130 v80 h100" fill="#76624d" stroke="#cfad75" stroke-width="14"/><path d="M730 482 l104 -70 l104 70 v230 h-208Z" fill="#182734" stroke="#e0b46b" stroke-width="12"/><path d="M440 570 h132 v80 h-132Z" fill="#1a2932" stroke="#b9824d" stroke-width="9"/>', [{ x: 92, y: 584, w: 132, h: 196, open: true }, { x: 738, y: 478, w: 194, h: 238, open: false, hint: true }], [[330, 520], [1220, 520]]],
  ['scene_chambre_gouverneur', 'Chambre du gouverneur', 23, '<rect x="210" y="210" width="1220" height="560" rx="16" fill="#60412e" stroke="#c99753" stroke-width="16"/><rect x="500" y="322" width="590" height="310" rx="12" fill="#dac08b" stroke="#5a3823" stroke-width="12"/><path d="M540 590 C660 436 858 512 1028 390" fill="none" stroke="#1d7380" stroke-width="18"/><path d="M1120 460 h190 v150 h-190Z" fill="#822f2b" stroke="#d7b16d" stroke-width="9"/><path d="M344 448 h154 v202 h-154Z" fill="#123a4e" stroke="#c99753" stroke-width="9"/>', [{ x: 90, y: 572, w: 130, h: 194, open: true }, { x: 1370, y: 550, w: 132, h: 204, open: false, hint: true }], [[430, 450], [1215, 520]]],
  ['scene_epave_santa_agueda', 'Épave de la Santa Águeda', 24, '<path d="M260 650 C350 462 530 366 770 378 C1030 391 1198 520 1390 598 C1190 710 862 758 560 722Z" fill="#4a2b1f" stroke="#b87a42" stroke-width="14"/><path d="M740 368 l70 -210 l70 212" stroke="#d4c2a0" stroke-width="12" fill="none"/><path d="M810 170 q146 54 220 160 q-144 -14 -258 -38Z" fill="#d6cfbd" opacity="0.56"/><path d="M0 700 C300 630 500 760 800 690 C1060 630 1350 720 1672 650 V941 H0Z" fill="#0c5b68" opacity="0.7"/><path d="M1000 620 l120 80 l-162 46Z" fill="#164d82"/>', [{ x: 84, y: 610, w: 132, h: 196, open: true }], [[280, 610], [1220, 595]]],
  ['scene_caverne_tresor', 'Caverne du trésor', 25, '<path d="M110 780 C210 410 470 210 836 210 C1202 210 1462 410 1572 780 L1450 941 H230Z" fill="#20313f" stroke="#d0ad68" stroke-width="20"/><path d="M520 630 C620 480 770 430 904 458 C1064 490 1196 566 1260 718 H450Z" fill="#091722"/><g opacity="0.95"><circle cx="620" cy="700" r="42" fill="#ffd35a"/><circle cx="780" cy="660" r="42" fill="#1fb26b"/><circle cx="960" cy="690" r="42" fill="#1f75d6"/><circle cx="1130" cy="650" r="42" fill="#d93c36"/></g><path d="M700 754 h470 v85 h-470Z" fill="#6b3a1e" stroke="#f0c15f" stroke-width="12"/>', [{ x: 90, y: 612, w: 130, h: 196, open: true }], [[580, 700], [1180, 650]]],
];

const artById = new Map(scenesArt.map(([id, title, seed, structure, passages, lanterns]) => [id, { id, title, seed, structure, passages, lanterns }]));

const hs = (id, name, x, y, width, height, patch = {}) => ({
  id, name, x, y, width, height,
  actionType: 'dialogue',
  dialogue: '',
  ...patch,
});

const logic = (id, name, advancedConditions, successPatch = {}, failureDialogue = 'Il manque encore une preuve claire.') => ({
  id,
  name,
  conditionType: 'advanced',
  advancedConditionMode: 'all',
  advancedConditions,
  actionType: 'default',
  dialogue: successPatch.dialogue || '',
  failureDialogue,
  ...successPatch,
});

const enigmaDefs = [
  {
    id: 'enigme_coffre_taverne_3862',
    name: 'Coffre du Pélican Bleu',
    type: 'code',
    question: "Le coffre accepte quatre chiffres. J'ai le vent, le sucre, les morts et la marée, dans cet ordre seulement.",
    solutionText: '3862',
    successMessage: 'Le coffre s’ouvre avec un souffle de bois gonflé. Les morceaux d’une lettre tombent sur le comptoir.',
    failMessage: "Les roues reviennent à zéro. L'ordre est bon à chercher ailleurs que dans la taverne.",
    unlockType: 'none',
    clueSceneIds: ['scene_phare_pointe', 'scene_marche_epices', 'scene_cimetiere_corsaires', 'scene_plage_cocotiers', 'scene_cabane_pecheur'],
    logicNotes: 'Vent=3 au phare, sucre=8 au marché, morts=6 au cimetière, marée=2 sur la plage; Mateo confirme l’ordre.',
  },
  {
    id: 'enigme_lettre_dechiree_ordre',
    name: 'Lettre déchirée du capitaine',
    type: 'misc',
    miscMode: 'ordering',
    question: "Les morceaux se suivent comme les marques vues sur l’île. La lettre parle de la route vers la clef.",
    miscChoices: [
      'Traverse quand la mer se retire,',
      'cherche le fort dont la cloche ne sonne plus,',
      'pose la clef dans la gueule du lion,',
      'et lis la carte sous les draps du gouverneur.',
    ],
    successMessage: 'La lettre redevient lisible. Le cartographe avait caché la clef sous le rebord de sa table.',
    failMessage: 'Les morceaux tiennent ensemble, mais le sens se casse. Les marques I à IV ne viennent pas de cette pièce.',
    unlockType: 'none',
    popupBackgroundData: asset('item-lettre-dechiree.png'),
    popupBackgroundName: 'item-lettre-dechiree.png',
    popupBackgroundOverlay: 'medium',
    clueSceneIds: ['scene_anse_contrebandiers', 'scene_chapelle_engloutie', 'scene_marche_epices', 'scene_phare_pointe'],
    logicNotes: 'Ordre par marques externes: anse I, chapelle II, marché/lion III, phare/drap IV.',
  },
  {
    id: 'enigme_carte_recif_puzzle',
    name: 'Carte du récif brisée',
    type: 'puzzle',
    question: 'La carte est coupée en neuf plaques. Les repères du récif doivent se rejoindre sans interrompre le chenal bleu.',
    imageData: asset('puzzle-carte-recif.png'),
    imageName: 'puzzle-carte-recif.png',
    gridRows: 3,
    gridCols: 3,
    successMessage: 'Le chenal apparaît. La route passe par l’épave avant de rejoindre la porte de corail.',
    failMessage: 'Le chenal ne rejoint pas encore le récif nord.',
    unlockType: 'scene',
    targetSceneId: 'scene_epave_santa_agueda',
    clueSceneIds: ['scene_mangrove_lucioles', 'scene_cabane_pecheur', 'scene_cimetiere_corsaires', 'scene_chapelle_engloutie'],
    logicNotes: 'Les indices externes fixent l’orientation: sud-ouest vers nord, coquille au centre, crâne sous la pointe nord, récif est ouvert.',
  },
  {
    id: 'enigme_vitrail_caverne_couleurs',
    name: 'Vitrail de marée',
    type: 'colors',
    question: 'Les quatre pierres de corail prennent les couleurs vues sur la route du capitaine.',
    solutionColors: ['red', 'yellow', 'green', 'blue'],
    successMessage: 'Les pierres restent allumées. La mer se retire derrière la paroi et le trésor respire enfin.',
    failMessage: 'Les pierres s’éteignent. Il manque l’ordre des couleurs croisées sur l’île.',
    unlockType: 'cinematic',
    targetCinematicId: 'cine_final_tresor_ouvert',
    clueSceneIds: ['scene_marche_epices', 'scene_plage_cocotiers', 'scene_mangrove_lucioles', 'scene_epave_santa_agueda'],
    logicNotes: 'Rouge marché, jaune plage, vert mangrove, bleu épave.',
  },
];

const scenes = [
  {
    id: 'scene_anse_contrebandiers',
    name: 'Anse des contrebandiers',
    introText: "J’ai repris pied sur l’anse au lever de lune. Les traces dans le sable partent dans trois directions, et aucune ne ressemble à un retour.",
    hotspots: [
      hs('hs_anse_taverne', 'Chemin de la taverne', 80, 56, 13, 25, { actionType: 'scene', targetSceneId: 'scene_taverne_pelican_bleu', dialogue: "La taverne garde sa porte ouverte. L’odeur de rhum passe avant la lumière." }),
      hs('hs_anse_marche', 'Rue du marché', 35, 59, 13, 22, { actionType: 'scene', targetSceneId: 'scene_marche_epices', dialogue: "Les bâches du marché claquent encore, même à cette heure." }),
      hs('hs_anse_plage', 'Plage aux cocotiers', 65, 61, 14, 21, { actionType: 'scene', targetSceneId: 'scene_plage_cocotiers', dialogue: "Le sable descend vers la pointe et la cabane du pêcheur." }),
      hs('hs_anse_cercle_boussole', 'Caisse sous le ponton', 17, 69, 15, 14, { actionType: 'dialogue_item', rewardItemId: 'item_cercle_boussole_fendu', dialogue: "Sous les cordages, je trouve un cercle de boussole fendu. Quelqu’un a gardé le reste ailleurs." }),
      hs('hs_anse_marque_i', 'Pieu gravé I', 48, 58, 7, 10, { dialogue: "Le pieu porte une seule entaille nette. Je la note comme le premier morceau de la lettre." }),
      hs('hs_anse_epave_visible', 'Épave au large', 75, 38, 16, 10, { dialogue: "L’épave au large ne bouge pas. Elle paraît proche, mais le récif coupe la route." }),
    ],
  },
  {
    id: 'scene_taverne_pelican_bleu',
    name: 'Taverne du Pélican Bleu',
    introText: "La salle est vide sauf Mateo. Il n’a pas l’air surpris de me voir; c’est rarement bon signe.",
    hotspots: [
      hs('hs_taverne_retour_anse', 'Retour vers l’anse', 5, 58, 14, 24, { actionType: 'scene', targetSceneId: 'scene_anse_contrebandiers', dialogue: "Je retrouve l’air libre de l’anse." }),
      hs('hs_taverne_marche', 'Porte du marché', 76, 53, 13, 23, { actionType: 'scene', targetSceneId: 'scene_marche_epices', dialogue: "La porte latérale donne sur les étals d’épices." }),
      hs('hs_taverne_fortin', 'Porte du fortin', 84, 47, 12, 27, {
        actionType: 'scene',
        targetSceneId: 'scene_fortin_espagnol',
        requiredItemId: 'item_clef_cuivre',
        lockedMessage: "La serrure du fortin porte un lion. Sans la clef de cuivre, elle ne bougera pas.",
        dialogue: "La clef de cuivre tourne dans la gueule du lion. Le passage du fortin s’ouvre.",
        logicRules: [logic('rule_taverne_fortin_clef', 'Fortin: clef de cuivre requise', [{ id: 'cond_fortin_clef', type: 'has_item', itemId: 'item_clef_cuivre' }], {}, "La porte du fortin reste close. Il faut la clef de cuivre trouvée grâce à la lettre.")],
      }),
      hs('hs_taverne_coffre', 'Coffre clouté', 19, 56, 17, 15, {
        actionType: 'dialogue_item',
        enigmaId: 'enigme_coffre_taverne_3862',
        rewardItemId: 'item_lettre_dechiree',
        dialogue: "Je garde les morceaux de lettre. Le papier sent le sel et la cire.",
        logicRules: [logic('rule_coffre_indices_externes', 'Coffre: quatre indices et ordre de Mateo', [
          { id: 'cond_code_vent_3', type: 'completed_hotspot', hotspotId: 'hs_phare_vent_3' },
          { id: 'cond_code_sucre_8', type: 'completed_hotspot', hotspotId: 'hs_marche_sucre_8' },
          { id: 'cond_code_morts_6', type: 'completed_hotspot', hotspotId: 'hs_cimetiere_rivas_6' },
          { id: 'cond_code_maree_2', type: 'completed_hotspot', hotspotId: 'hs_plage_maree_2' },
          { id: 'cond_code_mateo_ordre', type: 'chose_reply', replyId: 'reply_mateo_ordre_coffre' },
        ], {}, "Le coffre peut attendre. Je n’ai pas encore tous les chiffres, ni l’ordre confirmé par Mateo.")],
      }),
      hs('hs_taverne_mateo', 'Mateo le pêcheur', 55, 45, 14, 30, {
        actionType: 'conversation',
        dialogue: "Mateo replie son couteau et regarde la porte, pas moi.",
        conversation: {
          startNodeId: 'node_mateo_start',
          nodes: [
            {
              id: 'node_mateo_start',
              speaker: 'Mateo',
              text: "Si tu cherches Rivas, ne commence pas par le coffre. Commence par ce qu’il regardait avant de boire.",
              replies: [
                { id: 'reply_mateo_ordre_coffre', label: 'L’ordre du coffre', actionType: 'dialogue', dialogue: "Mateo baisse la voix: vent, sucre, morts, marée. Pas un mot de plus tant que le coffre est fermé.", hideAfterChosen: true },
                { id: 'reply_mateo_boussole', label: 'La boussole cassée', actionType: 'dialogue', dialogue: "Il manque l’aiguille. Les pêcheurs aimantent leurs hameçons dans la cabane quand la houle casse les compas.", hideAfterChosen: true },
                { id: 'reply_mateo_fin', label: 'Je repars', actionType: 'end', dialogue: "Mateo garde ses yeux sur la porte du fortin." },
              ],
            },
          ],
        },
      }),
    ],
  },
  {
    id: 'scene_marche_epices',
    name: 'Marché aux épices',
    introText: "Les étals dorment sous les toiles rouges. Les marchands ont laissé assez de désordre pour cacher une piste.",
    hotspots: [
      hs('hs_marche_retour_anse', 'Rue vers l’anse', 5, 58, 12, 24, { actionType: 'scene', targetSceneId: 'scene_anse_contrebandiers', dialogue: "Je reviens vers le bruit des vagues." }),
      hs('hs_marche_taverne', 'Porte de la taverne', 17, 54, 11, 23, { actionType: 'scene', targetSceneId: 'scene_taverne_pelican_bleu', dialogue: "La porte bleue de la taverne grince encore." }),
      hs('hs_marche_atelier', 'Atelier du cartographe', 80, 52, 12, 23, { actionType: 'scene', targetSceneId: 'scene_atelier_cartographe', dialogue: "Une lampe brûle dans l’atelier du cartographe." }),
      hs('hs_marche_sucre_8', 'Caisse de sucre', 23, 57, 12, 12, { dialogue: "La caisse de sucre tient avec huit clous de cuivre. Le second chiffre se tient là, sans fioriture." }),
      hs('hs_marche_lion_iii', 'Lion de cuivre', 66, 53, 11, 14, { dialogue: "Le petit lion de cuivre porte trois griffes levées. C’est la troisième marque de la lettre." }),
      hs('hs_marche_couleur_rouge', 'Bol de piments rouges', 38, 58, 10, 12, { dialogue: "Rivas marquait ses routes en couleurs. Ici, le rouge vient avant les autres." }),
    ],
  },
  {
    id: 'scene_atelier_cartographe',
    name: 'Atelier du cartographe',
    introText: "L’atelier sent l’encre, le sel et la peur récente. Une grande table occupe la pièce comme une mer à elle seule.",
    hotspots: [
      hs('hs_atelier_retour_marche', 'Retour marché', 6, 58, 12, 23, { actionType: 'scene', targetSceneId: 'scene_marche_epices', dialogue: "Je sors vers les bâches rouges du marché." }),
      hs('hs_atelier_chapelle', 'Sentier de la chapelle', 80, 53, 13, 24, { actionType: 'scene', targetSceneId: 'scene_chapelle_engloutie', dialogue: "Le sentier descend vers la chapelle noyée." }),
      hs('hs_atelier_lettre', 'Table de recollage', 35, 39, 25, 26, {
        actionType: 'dialogue_item',
        enigmaId: 'enigme_lettre_dechiree_ordre',
        requiredItemId: 'item_lettre_dechiree',
        rewardItemId: 'item_clef_cuivre',
        lockedMessage: "La table a de la cire et du fil, mais il me manque les morceaux de la lettre.",
        dialogue: "Sous le rebord, mes doigts accrochent une clef de cuivre salée.",
        logicRules: [logic('rule_lettre_indices_externes', 'Lettre: marques I à IV vues ailleurs', [
          { id: 'cond_lettre_item', type: 'has_item', itemId: 'item_lettre_dechiree' },
          { id: 'cond_lettre_i', type: 'completed_hotspot', hotspotId: 'hs_anse_marque_i' },
          { id: 'cond_lettre_ii', type: 'completed_hotspot', hotspotId: 'hs_chapelle_cloche_ii' },
          { id: 'cond_lettre_iii', type: 'completed_hotspot', hotspotId: 'hs_marche_lion_iii' },
          { id: 'cond_lettre_iv', type: 'completed_hotspot', hotspotId: 'hs_phare_drap_iv' },
        ], {}, "La lettre ne se recolle pas au hasard. Il me faut les quatre marques vues ailleurs.")],
      }),
      hs('hs_atelier_encre', 'Encrier renversé', 61, 52, 9, 11, { dialogue: "L’encre a coulé vers l’est. Le cartographe a quitté la table vite, pas proprement." }),
      hs('hs_atelier_carnet', 'Carnet du cartographe', 51, 35, 11, 11, { dialogue: "Une note simple: la carte du récif ne sert à rien sans une boussole complète." }),
    ],
  },
  {
    id: 'scene_plage_cocotiers',
    name: 'Plage aux cocotiers',
    introText: "La plage ouvre plusieurs chemins. La mer donne de la place à marée basse, puis la reprend sans discuter.",
    hotspots: [
      hs('hs_plage_retour_anse', 'Retour vers l’anse', 5, 60, 12, 23, { actionType: 'scene', targetSceneId: 'scene_anse_contrebandiers', dialogue: "Je remonte vers l’anse." }),
      hs('hs_plage_cabane', 'Cabane du pêcheur', 69, 55, 13, 22, { actionType: 'scene', targetSceneId: 'scene_cabane_pecheur', dialogue: "La cabane est ouverte, et le filet suspendu bouge avec le vent." }),
      hs('hs_plage_phare', 'Chemin du phare', 84, 51, 11, 22, { actionType: 'scene', targetSceneId: 'scene_phare_pointe', dialogue: "La pointe du phare coupe le ciel." }),
      hs('hs_plage_cimetiere', 'Sente du cimetière', 23, 55, 12, 21, { actionType: 'scene', targetSceneId: 'scene_cimetiere_corsaires', dialogue: "Les croix du cimetière dépassent derrière les cocotiers." }),
      hs('hs_plage_grotte', 'Passe du ressac', 50, 64, 16, 18, {
        actionType: 'scene',
        targetSceneId: 'scene_grotte_ressac',
        requiredItemId: 'item_boussole_reparee',
        lockedMessage: "Le ressac brouille le passage. Sans boussole réparée, je tournerais dans les rochers.",
        dialogue: "La boussole tremble puis se stabilise. La passe s’ouvre entre deux vagues.",
        logicRules: [logic('rule_plage_grotte_boussole', 'Grotte: boussole réparée', [{ id: 'cond_grotte_boussole', type: 'has_item', itemId: 'item_boussole_reparee' }], {}, "Le passage existe, mais il me faut une boussole réparée pour le tenir.")],
      }),
      hs('hs_plage_maree_2', 'Deux marques de marée', 43, 69, 10, 10, { dialogue: "Deux traits sont gravés au niveau de la marée basse. Le dernier chiffre du coffre est plus utile que joli." }),
      hs('hs_plage_couleur_jaune', 'Sable doré sous les rochers', 58, 66, 12, 10, { dialogue: "Le sable pris dans les rochers garde une couleur jaune nette. Sur la route de Rivas, elle vient après le rouge." }),
    ],
  },
  {
    id: 'scene_cabane_pecheur',
    name: 'Cabane du pêcheur',
    introText: "La cabane donne sur la plage et le phare. Chaque objet semble avoir été posé pour servir deux fois.",
    hotspots: [
      hs('hs_cabane_retour_plage', 'Retour plage', 5, 62, 12, 22, { actionType: 'scene', targetSceneId: 'scene_plage_cocotiers', dialogue: "Je retrouve la plage." }),
      hs('hs_cabane_phare', 'Piste du phare', 78, 57, 11, 22, { actionType: 'scene', targetSceneId: 'scene_phare_pointe', dialogue: "La piste rejoint la base du phare." }),
      hs('hs_cabane_aiguille', 'Filet aimanté', 43, 56, 16, 15, { actionType: 'dialogue_item', rewardItemId: 'item_aiguille_aimantee', dialogue: "Au milieu des hameçons, une aiguille aimantée colle au métal. Elle attendait son cercle." }),
      hs('hs_cabane_recif_est', 'Carte du pêcheur', 60, 43, 12, 12, { dialogue: "Le dessin du pêcheur montre le récif ouvert à l’est. Je garde ce repère pour la carte brisée." }),
      hs('hs_cabane_hamecons', 'Hameçons rouillés', 29, 57, 10, 11, { dialogue: "Les hameçons sont rangés par taille. Mateo ment peu; il cache surtout ce qu’il sait." }),
    ],
  },
  {
    id: 'scene_phare_pointe',
    name: 'Phare de la Pointe',
    introText: "Le phare éclaire le marché, la plage et l’épave. Ici, les distances paraissent franchissables; c’est un piège classique de la mer.",
    hotspots: [
      hs('hs_phare_retour_plage', 'Retour plage', 5, 62, 12, 22, { actionType: 'scene', targetSceneId: 'scene_plage_cocotiers', dialogue: "Je redescends vers le sable." }),
      hs('hs_phare_cabane', 'Sentier de la cabane', 82, 60, 11, 20, { actionType: 'scene', targetSceneId: 'scene_cabane_pecheur', dialogue: "Le sentier retombe derrière la cabane." }),
      hs('hs_phare_vent_3', 'Troisième lanterne', 48, 28, 12, 14, { dialogue: "La troisième lanterne porte une girouette gravée. Vent: trois. Le coffre ne pourra pas faire semblant." }),
      hs('hs_phare_drap_iv', 'Drap blanc séché au vent', 63, 62, 12, 13, { dialogue: "Quatre pinces tiennent le drap. Je classe ce signe comme le quatrième morceau de la lettre." }),
      hs('hs_phare_epave_visible', 'Épave dans le faisceau', 74, 39, 16, 11, { dialogue: "Le faisceau touche l’épave, puis le récif. La route n’est pas directe." }),
    ],
  },
  {
    id: 'scene_cimetiere_corsaires',
    name: 'Cimetière des corsaires',
    introText: "Les tombes regardent la mer. Les morts ont plus d’ordre que les vivants sur cette île.",
    hotspots: [
      hs('hs_cimetiere_retour_plage', 'Retour plage', 5, 61, 12, 22, { actionType: 'scene', targetSceneId: 'scene_plage_cocotiers', dialogue: "Je quitte les tombes pour le sable." }),
      hs('hs_cimetiere_chapelle', 'Porche de chapelle', 47, 50, 12, 18, { actionType: 'scene', targetSceneId: 'scene_chapelle_engloutie', dialogue: "Le porche de la chapelle est noyé jusqu’aux marches." }),
      hs('hs_cimetiere_mangrove', 'Sentier de mangrove', 84, 55, 12, 22, {
        actionType: 'scene',
        targetSceneId: 'scene_mangrove_lucioles',
        requiredItemId: 'item_boussole_reparee',
        lockedMessage: "Le sentier se divise dans l’eau noire. Sans boussole réparée, je perdrais le cimetière derrière moi.",
        dialogue: "La boussole pointe entre les racines. La mangrove accepte une ligne droite.",
        logicRules: [logic('rule_cimetiere_mangrove_boussole', 'Mangrove: boussole réparée', [{ id: 'cond_mangrove_boussole', type: 'has_item', itemId: 'item_boussole_reparee' }], {}, "La mangrove brouille les directions. Il me faut une boussole réparée.")],
      }),
      hs('hs_cimetiere_rivas_6', 'Tombe de Rivas', 35, 56, 11, 14, { dialogue: "Six coquilles entourent la tombe de Rivas. Les morts gardent le troisième chiffre du coffre." }),
      hs('hs_cimetiere_crane_nord', 'Crâne sous la pointe nord', 62, 58, 10, 12, { dialogue: "Un crâne est posé sous la pointe nord de la stèle. La carte du récif devra garder ce nord-là." }),
    ],
  },
  {
    id: 'scene_chapelle_engloutie',
    name: 'Chapelle engloutie',
    introText: "L’eau couvre le sol de la chapelle. Les bancs flottent de travers, mais la cloche tient encore au-dessus.",
    hotspots: [
      hs('hs_chapelle_retour_cimetiere', 'Retour cimetière', 5, 62, 12, 21, { actionType: 'scene', targetSceneId: 'scene_cimetiere_corsaires', dialogue: "Je remonte vers les tombes." }),
      hs('hs_chapelle_atelier', 'Sentier atelier', 78, 60, 12, 21, { actionType: 'scene', targetSceneId: 'scene_atelier_cartographe', dialogue: "Le sentier rejoint l’atelier du cartographe." }),
      hs('hs_chapelle_cloche_ii', 'Cloche fendue', 47, 30, 12, 16, { dialogue: "La cloche est fendue en deux lèvres nettes. C’est le deuxième signe de la lettre." }),
      hs('hs_chapelle_coquille_centre', 'Coquille au centre', 49, 56, 10, 10, { dialogue: "Une coquille blanche marque le centre du vitrail noyé. La carte brisée aura besoin d’un centre pareil." }),
      hs('hs_chapelle_eau', 'Eau salée', 32, 67, 12, 10, { dialogue: "L’eau entre par le côté nord. À marée haute, cette pièce doit avaler ses propres indices." }),
    ],
  },
  {
    id: 'scene_mangrove_lucioles',
    name: 'Mangrove des lucioles',
    introText: "La mangrove ferme le ciel. Les lucioles dessinent des routes plus franches que les racines.",
    hotspots: [
      hs('hs_mangrove_retour_cimetiere', 'Retour cimetière', 5, 62, 12, 21, { actionType: 'scene', targetSceneId: 'scene_cimetiere_corsaires', dialogue: "La boussole me ramène aux tombes." }),
      hs('hs_mangrove_grotte', 'Passe vers la grotte', 84, 55, 12, 22, { actionType: 'scene', targetSceneId: 'scene_grotte_ressac', dialogue: "La passe s’ouvre vers la grotte du ressac." }),
      hs('hs_mangrove_lucioles_sw_n', 'Lucioles en diagonale', 42, 48, 18, 16, { dialogue: "Les lucioles montent du sud-ouest vers le nord. Sur la carte du récif, cette diagonale doit rester entière." }),
      hs('hs_mangrove_couleur_verte', 'Lueur verte', 67, 54, 12, 12, { dialogue: "La lumière verte vient après le rouge et le jaune. Je la garde pour les pierres de corail." }),
      hs('hs_mangrove_racines', 'Racines creuses', 23, 64, 14, 12, { dialogue: "Les racines gardent des bulles d’air. Le passage n’est pas profond, seulement confus." }),
    ],
  },
  {
    id: 'scene_grotte_ressac',
    name: 'Grotte du ressac',
    introText: "La grotte résonne comme une cale de navire. Deux issues existent: une vers l’eau, une vers la roche fermée.",
    hotspots: [
      hs('hs_grotte_retour_plage', 'Retour plage', 5, 65, 12, 20, { actionType: 'scene', targetSceneId: 'scene_plage_cocotiers', dialogue: "Je reviens vers la plage avant que l’eau remonte." }),
      hs('hs_grotte_mangrove', 'Retour mangrove', 81, 57, 12, 22, { actionType: 'scene', targetSceneId: 'scene_mangrove_lucioles', dialogue: "Le passage latéral retrouve les racines de la mangrove." }),
      hs('hs_grotte_epave', 'Chenal vers l’épave', 44, 49, 18, 23, {
        actionType: 'scene',
        targetSceneId: 'scene_epave_santa_agueda',
        requiredItemId: 'item_boussole_reparee',
        lockedMessage: "Le chenal se perd dans le récif. La carte réparée et la boussole doivent parler ensemble.",
        dialogue: "Le chenal de la carte rejoint la mer. La boussole ne tremble plus.",
        logicRules: [logic('rule_grotte_epave_puzzle_boussole', 'Épave: carte puzzle et boussole', [
          { id: 'cond_epave_boussole', type: 'has_item', itemId: 'item_boussole_reparee' },
          { id: 'cond_epave_puzzle', type: 'solved_enigma', enigmaId: 'enigme_carte_recif_puzzle' },
        ], {}, "L’épave est visible, mais le chenal reste trop risqué sans carte réparée et boussole.")],
      }),
      hs('hs_grotte_caverne', 'Porte de corail', 70, 53, 16, 23, {
        actionType: 'scene',
        targetSceneId: 'scene_caverne_tresor',
        requiredItemId: 'item_amulette_corail',
        lockedMessage: "La porte de corail reste froide. Il lui manque l’amulette noire.",
        dialogue: "L’amulette chauffe dans ma paume. La roche s’écarte sans bruit.",
        logicRules: [logic('rule_grotte_caverne_amulette', 'Caverne: amulette et route complète', [
          { id: 'cond_caverne_amulette', type: 'has_item', itemId: 'item_amulette_corail' },
          { id: 'cond_caverne_puzzle', type: 'solved_enigma', enigmaId: 'enigme_carte_recif_puzzle' },
          { id: 'cond_caverne_lettre', type: 'solved_enigma', enigmaId: 'enigme_lettre_dechiree_ordre' },
        ], {}, "La porte de corail refuse de s’ouvrir. L’amulette, la carte et la lettre doivent être réglées avant.")],
      }),
      hs('hs_grotte_paroi_sel', 'Paroi salée', 31, 56, 12, 13, { dialogue: "Le sel forme une ligne au-dessus de ma tête. La marée gagne vite ici." }),
    ],
  },
  {
    id: 'scene_fortin_espagnol',
    name: 'Fortin espagnol',
    introText: "Le fortin est plus petit que son ombre. Sa porte donne sur la taverne; la chambre du gouverneur dort derrière une seconde serrure.",
    hotspots: [
      hs('hs_fortin_retour_taverne', 'Retour taverne', 5, 63, 12, 21, { actionType: 'scene', targetSceneId: 'scene_taverne_pelican_bleu', dialogue: "Je retrouve le bois chaud de la taverne." }),
      hs('hs_fortin_chambre', 'Porte du gouverneur', 45, 52, 15, 25, {
        actionType: 'scene',
        targetSceneId: 'scene_chambre_gouverneur',
        requiredItemId: 'item_clef_cuivre',
        lockedMessage: "La serrure du gouverneur accepte la clef de cuivre, mais seulement si la lettre a livré son ordre.",
        dialogue: "La clef tourne une deuxième fois. La chambre du gouverneur sent la poussière sèche.",
        logicRules: [logic('rule_fortin_chambre_lettre_clef', 'Chambre: clef et lettre résolue', [
          { id: 'cond_chambre_clef', type: 'has_item', itemId: 'item_clef_cuivre' },
          { id: 'cond_chambre_lettre', type: 'solved_enigma', enigmaId: 'enigme_lettre_dechiree_ordre' },
        ], {}, "La porte attend la clef et le sens complet de la lettre.")],
      }),
      hs('hs_fortin_canons', 'Canons rouillés', 26, 55, 12, 13, { dialogue: "Les canons pointent vers l’épave, pas vers le large. Le gouverneur savait où Rivas avait coulé." }),
      hs('hs_fortin_lion_serrure', 'Serrure au lion', 53, 50, 8, 10, { dialogue: "Le lion gravé a les dents usées par la même clef. La lettre disait vrai." }),
    ],
  },
  {
    id: 'scene_chambre_gouverneur',
    name: 'Chambre du gouverneur',
    introText: "La chambre est intacte, presque trop. Le gouverneur n’a pas fui; il a rangé la suite du voyage.",
    hotspots: [
      hs('hs_chambre_retour_fortin', 'Retour fortin', 5, 62, 12, 21, { actionType: 'scene', targetSceneId: 'scene_fortin_espagnol', dialogue: "Je retourne dans la cour du fortin." }),
      hs('hs_chambre_carte_puzzle', 'Carte sous les draps', 34, 38, 32, 31, {
        actionType: 'dialogue_item',
        enigmaId: 'enigme_carte_recif_puzzle',
        requiredItemId: 'item_boussole_reparee',
        rewardItemId: 'item_amulette_corail',
        lockedMessage: "La carte réagit au métal. Sans boussole réparée, les plaques restent ternes.",
        dialogue: "Une amulette de corail noir tombe de la doublure de la carte.",
        logicRules: [logic('rule_puzzle_indices_externes', 'Carte: boussole et quatre repères externes', [
          { id: 'cond_puzzle_boussole', type: 'has_item', itemId: 'item_boussole_reparee' },
          { id: 'cond_puzzle_lucioles', type: 'completed_hotspot', hotspotId: 'hs_mangrove_lucioles_sw_n' },
          { id: 'cond_puzzle_recif_est', type: 'completed_hotspot', hotspotId: 'hs_cabane_recif_est' },
          { id: 'cond_puzzle_crane', type: 'completed_hotspot', hotspotId: 'hs_cimetiere_crane_nord' },
          { id: 'cond_puzzle_coquille', type: 'completed_hotspot', hotspotId: 'hs_chapelle_coquille_centre' },
        ], {}, "La carte brisée demande ses repères: lucioles, récif est, crâne nord et coquille centrale.")],
      }),
      hs('hs_chambre_lit', 'Lit aux draps rouges', 66, 50, 14, 16, { dialogue: "Les draps sont rouges, mais la lettre parlait surtout de ce qui se cache dessous." }),
      hs('hs_chambre_fenetre_epave', 'Fenêtre sur l’épave', 22, 45, 11, 15, { dialogue: "Depuis la chambre, l’épave paraît alignée avec la grotte. La carte doit confirmer le chenal." }),
    ],
  },
  {
    id: 'scene_epave_santa_agueda',
    name: 'Épave de la Santa Águeda',
    introText: "L’épave tient encore par orgueil. Le bois craque, mais le récif autour d’elle laisse passer une barque prudente.",
    hotspots: [
      hs('hs_epave_retour_grotte', 'Retour chenal', 5, 63, 12, 21, { actionType: 'scene', targetSceneId: 'scene_grotte_ressac', dialogue: "Je reprends le chenal vers la grotte." }),
      hs('hs_epave_couleur_bleue', 'Cordage bleu', 60, 64, 14, 12, { dialogue: "Un cordage bleu bloque l’écoutille. Sur la route de Rivas, le bleu vient après le vert." }),
      hs('hs_epave_journal_bord', 'Journal détrempé', 35, 57, 13, 13, { dialogue: "Le journal répète une chose claire: la porte de corail ne s’ouvre pas pour l’or, seulement pour l’amulette." }),
      hs('hs_epave_cale', 'Cale effondrée', 72, 57, 12, 18, { dialogue: "La cale est effondrée. Le trésor n’est plus ici depuis longtemps." }),
      hs('hs_epave_vue_fortin', 'Fortin au loin', 22, 40, 15, 10, { dialogue: "Le fortin regarde encore l’épave. Les Espagnols ont surveillé le mauvais coffre." }),
    ],
  },
  {
    id: 'scene_caverne_tresor',
    name: 'Caverne du trésor',
    introText: "La caverne n’est pas une salle d’or. C’est une serrure immense, éclairée par quatre pierres de corail.",
    hotspots: [
      hs('hs_caverne_retour_grotte', 'Retour grotte', 5, 64, 12, 21, { actionType: 'scene', targetSceneId: 'scene_grotte_ressac', dialogue: "La porte de corail me laisse ressortir vers la grotte." }),
      hs('hs_caverne_vitrail', 'Pierres de corail', 39, 61, 32, 20, {
        actionType: 'dialogue',
        enigmaId: 'enigme_vitrail_caverne_couleurs',
        dialogue: "Les pierres restent allumées, et l’air change de goût.",
        logicRules: [logic('rule_vitrail_indices_couleurs', 'Vitrail: quatre couleurs vues ailleurs', [
          { id: 'cond_color_red', type: 'completed_hotspot', hotspotId: 'hs_marche_couleur_rouge' },
          { id: 'cond_color_yellow', type: 'completed_hotspot', hotspotId: 'hs_plage_couleur_jaune' },
          { id: 'cond_color_green', type: 'completed_hotspot', hotspotId: 'hs_mangrove_couleur_verte' },
          { id: 'cond_color_blue', type: 'completed_hotspot', hotspotId: 'hs_epave_couleur_bleue' },
          { id: 'cond_color_amulette', type: 'has_item', itemId: 'item_amulette_corail' },
        ], {}, "Les pierres attendent les quatre couleurs vues dehors et l’amulette en main.")],
      }),
      hs('hs_caverne_coffres', 'Coffres scellés', 52, 72, 22, 12, { dialogue: "Les coffres sont scellés. Je sens que les ouvrir avant les pierres ne ferait qu’inonder la caverne." }),
      hs('hs_caverne_mer_derriere', 'Mer derrière la paroi', 73, 50, 13, 15, { dialogue: "La mer bat derrière la roche. Toute cette histoire tient à une marée de retard." }),
    ],
  },
];

scenes.forEach((scene) => {
  const art = artById.get(scene.id);
  scene.actId = 'act_chasse_tresor_caraibes';
  scene.parentSceneId = '';
  scene.backgroundName = `${scene.id.replace('scene_', 'scene-')}.png`;
  scene.backgroundData = asset(scene.backgroundName);
  scene.backgroundWidth = W;
  scene.backgroundHeight = H;
  scene.backgroundAspectRatio = W / H;
  scene.visualEffect = ['scene_grotte_ressac', 'scene_caverne_tresor'].includes(scene.id) ? 'vignette' : 'glow';
  scene.visualEffectIntensity = 'subtle';
  scene.sceneTransition = 'fade';
  scene.sceneTransitionDuration = 850;
  scene.sceneObjects = [];
  art.fileName = scene.backgroundName;
  art.elements = [];
});

const cinematics = [
  {
    id: 'cine_intro_arrivee_caraibes',
    name: 'Arrivée à l’anse',
    cinematicType: 'slides',
    slides: [
      {
        id: 'slide_intro_01_goelette',
        imageData: asset('cine-intro-01-goelette.png'),
        imageName: 'cine-intro-01-goelette.png',
        narration: "La goélette m’a laissée avant l’aube. Si Rivas a vraiment caché son trésor ici, l’île ne l’a pas oublié.",
      },
      {
        id: 'slide_intro_02_carte',
        imageData: asset('cine-intro-02-carte.png'),
        imageName: 'cine-intro-02-carte.png',
        narration: "La vieille carte ne montre pas une route. Elle montre des erreurs à éviter.",
      },
      {
        id: 'slide_intro_03_anse',
        imageData: asset('cine-intro-03-anse.png'),
        imageName: 'cine-intro-03-anse.png',
        narration: "En posant le pied sur le ponton, je comprends une chose simple: le trésor ne sera pas au bout d’un seul chemin.",
      },
    ],
    onEndType: 'scene',
    targetSceneId: 'scene_anse_contrebandiers',
  },
  {
    id: 'cine_final_tresor_ouvert',
    name: 'Le trésor de Rivas',
    cinematicType: 'slides',
    slides: [
      {
        id: 'slide_final_01_pierres',
        imageData: asset('cine-final-01-pierres.png'),
        imageName: 'cine-final-01-pierres.png',
        narration: "Les quatre pierres gardent leur lumière. La mer se retire comme si elle venait de perdre une discussion ancienne.",
      },
      {
        id: 'slide_final_02_coffres',
        imageData: asset('cine-final-02-coffres.png'),
        imageName: 'cine-final-02-coffres.png',
        narration: "Les coffres de Rivas sortent du sable. L’or compte moins que la preuve: chaque indice menait vraiment quelque part.",
      },
      {
        id: 'slide_final_03_depart',
        imageData: asset('cine-final-03-depart.png'),
        imageName: 'cine-final-03-depart.png',
        narration: "Je quitte la caverne avant la marée. Derrière moi, l’île referme ses portes, mais pas assez vite pour garder mon nom.",
      },
    ],
    onEndType: 'none',
  },
];

const combinations = [
  {
    id: 'combo_boussole_reparee',
    itemAId: 'item_cercle_boussole_fendu',
    itemBId: 'item_aiguille_aimantee',
    resultItemId: 'item_boussole_reparee',
    message: "J’emboîte l’aiguille dans le cercle fendu. La boussole n’est pas belle, mais elle reprend le nord.",
    consume: true,
    conditions: [],
    failMessage: '',
  },
];

const project = {
  id: 'project_chasse_tresor_caraibes',
  title: 'Chasse au trésor dans les Caraïbes',
  description: 'Escape game non linéaire en un acte: coffre à code, lettre déchirée, carte puzzle, vitrail de couleurs, boussole à réparer, PNJ et portes verrouillées.',
  creationMode: 'expert',
  version: '1.0.0',
  exportedAt: new Date('2026-06-09T12:00:00.000Z').toISOString(),
  acts: [{ id: 'act_chasse_tresor_caraibes', name: 'Acte I - L’île de Rivas' }],
  start: { type: 'cinematic', targetSceneId: 'scene_anse_contrebandiers', targetCinematicId: 'cine_intro_arrivee_caraibes' },
  items: items.map(({ shape, ...item }) => item),
  combinations,
  enigmas: enigmaDefs,
  cinematics,
  scenes,
  storyVariables: [],
  routeMap: {
    rows: 16,
    cols: 24,
    cells: [],
    rooms: [
      ['room_anse', 'Anse', 'scene_anse_contrebandiers', 8, 48, 'start'],
      ['room_taverne', 'Taverne', 'scene_taverne_pelican_bleu', 24, 38, 'room'],
      ['room_marche', 'Marché', 'scene_marche_epices', 24, 58, 'room'],
      ['room_atelier', 'Atelier', 'scene_atelier_cartographe', 40, 58, 'room'],
      ['room_plage', 'Plage', 'scene_plage_cocotiers', 24, 78, 'room'],
      ['room_cabane', 'Cabane', 'scene_cabane_pecheur', 42, 82, 'room'],
      ['room_phare', 'Phare', 'scene_phare_pointe', 56, 82, 'room'],
      ['room_cimetiere', 'Cimetière', 'scene_cimetiere_corsaires', 42, 70, 'room'],
      ['room_chapelle', 'Chapelle', 'scene_chapelle_engloutie', 56, 66, 'room'],
      ['room_mangrove', 'Mangrove', 'scene_mangrove_lucioles', 66, 62, 'room'],
      ['room_grotte', 'Grotte', 'scene_grotte_ressac', 78, 70, 'room'],
      ['room_fortin', 'Fortin', 'scene_fortin_espagnol', 40, 34, 'room'],
      ['room_chambre', 'Chambre', 'scene_chambre_gouverneur', 56, 34, 'room'],
      ['room_epave', 'Épave', 'scene_epave_santa_agueda', 88, 54, 'room'],
      ['room_caverne', 'Caverne', 'scene_caverne_tresor', 92, 76, 'end'],
    ].map(([id, name, sceneId, x, y, type]) => ({ id, name, sceneId, x, y, type, canvasId: 'route_canvas_caraibes' })),
    connections: [
      ['route_anse_taverne', 'room_anse', 'room_taverne', 'Ouvert'],
      ['route_anse_marche', 'room_anse', 'room_marche', 'Ouvert'],
      ['route_anse_plage', 'room_anse', 'room_plage', 'Ouvert'],
      ['route_taverne_marche', 'room_taverne', 'room_marche', 'Ouvert'],
      ['route_marche_atelier', 'room_marche', 'room_atelier', 'Ouvert'],
      ['route_atelier_chapelle', 'room_atelier', 'room_chapelle', 'Ouvert'],
      ['route_plage_cabane', 'room_plage', 'room_cabane', 'Ouvert'],
      ['route_plage_phare', 'room_plage', 'room_phare', 'Ouvert'],
      ['route_plage_cimetiere', 'room_plage', 'room_cimetiere', 'Ouvert'],
      ['route_cabane_phare', 'room_cabane', 'room_phare', 'Ouvert'],
      ['route_cimetiere_chapelle', 'room_cimetiere', 'room_chapelle', 'Ouvert'],
      ['route_cimetiere_mangrove', 'room_cimetiere', 'room_mangrove', 'Boussole réparée', true],
      ['route_mangrove_grotte', 'room_mangrove', 'room_grotte', 'Ouvert'],
      ['route_plage_grotte', 'room_plage', 'room_grotte', 'Boussole réparée', true],
      ['route_taverne_fortin', 'room_taverne', 'room_fortin', 'Clef cuivre', true],
      ['route_fortin_chambre', 'room_fortin', 'room_chambre', 'Clef + lettre', true],
      ['route_grotte_epave', 'room_grotte', 'room_epave', 'Carte puzzle + boussole', true],
      ['route_grotte_caverne', 'room_grotte', 'room_caverne', 'Amulette + route complète', true],
    ].map(([id, fromRoomId, toRoomId, label, locked = false]) => ({ id, fromRoomId, toRoomId, label, locked, allowOneWay: false })),
    canvases: [{ id: 'route_canvas_caraibes', name: 'Île de Rivas - carte non linéaire' }],
    actMaps: {},
    notes: 'Tous les indices principaux sont hors de la pièce de leur énigme. Les portes ouvertes ont un retour, les passages verrouillés gardent un retour cohérent une fois franchis.',
  },
  metadata: {
    objectCount: 6,
    sceneCount: 15,
    enigmaCount: 4,
    cinematicCount: 2,
    combinationCount: 1,
    visualStyle: 'Illustration semi-réaliste peinte, Caraïbes nocturnes, turquoise, corail, bois sombre et lumière de lanternes.',
    solutions: {
      safeCode: '3862',
      letterOrder: enigmaDefs[1].miscChoices,
      colorSequence: ['red', 'yellow', 'green', 'blue'],
      itemCombination: 'Cercle de boussole fendu + Aiguille aimantée = Boussole réparée',
    },
  },
};

function cinematicArt(slideName, title) {
  const baseId = title.includes('trésor') || title.includes('pierres') || title.includes('coffres') || title.includes('départ')
    ? 'scene_caverne_tresor'
    : 'scene_anse_contrebandiers';
  const art = { ...artById.get(baseId), seed: slideName.length * 7, title: '' };
  if (slideName.includes('carte')) {
    art.structure = '<rect x="370" y="170" width="920" height="620" rx="24" fill="#d9b576" stroke="#70442d" stroke-width="18"/><path d="M470 560 C610 390 780 420 930 492 C1070 560 1130 442 1212 330" fill="none" stroke="#1e777b" stroke-width="22"/><path d="M520 664 C708 600 924 660 1120 568" stroke="#694327" stroke-width="12" stroke-dasharray="28 20" fill="none"/>';
  }
  if (slideName.includes('goelette')) {
    art.structure = '<path d="M420 610 q260 -170 620 0 v80 q-300 120 -620 0Z" fill="#3b241a" stroke="#c58d4a" stroke-width="14"/><path d="M780 590 l90 -310 l90 310" stroke="#d8c7a5" stroke-width="12" fill="none"/><path d="M865 295 q190 70 260 220 q-190 -18 -306 -70Z" fill="#ded3b7" opacity="0.8"/>';
  }
  if (slideName.includes('coffres')) {
    art.structure = '<path d="M260 760 C420 430 700 260 1050 330 C1320 384 1450 560 1520 780 L1420 941 H240Z" fill="#20313f" stroke="#d0ad68" stroke-width="18"/><rect x="560" y="610" width="250" height="120" rx="12" fill="#6b3a1e" stroke="#f0c15f" stroke-width="12"/><rect x="850" y="650" width="310" height="130" rx="12" fill="#5d321b" stroke="#ffd35a" stroke-width="12"/><circle cx="720" cy="670" r="34" fill="#ffd35a"/><circle cx="995" cy="715" r="34" fill="#ffd35a"/>';
  }
  if (slideName.includes('depart')) {
    art.structure = '<path d="M330 620 C560 500 900 520 1210 590 C1050 720 680 780 330 620Z" fill="#0d5e67"/><path d="M1010 560 q200 -100 360 18 v70 q-200 -60 -360 30Z" fill="#2e1d18" stroke="#b98345" stroke-width="8"/><path d="M170 720 C440 610 640 690 950 650 C1180 620 1390 680 1672 610 V941 H0 V760Z" fill="#d2aa70"/>';
  }
  return sceneSvg(art);
}

async function writePngFromSvg(svg, target, options = {}) {
  await sharp(Buffer.from(svg)).png(options).toFile(target);
}

async function generateAssets() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const art of artById.values()) {
    await writePngFromSvg(sceneSvg(art), file(art.fileName));
  }
  await writePngFromSvg(puzzleSvg(), file('puzzle-carte-recif.png'));
  for (const item of items) {
    await writePngFromSvg(itemSvg(item), file(item.imageName));
  }
  for (const cinematic of cinematics) {
    for (const slide of cinematic.slides) {
      await writePngFromSvg(cinematicArt(slide.imageName, slide.narration), file(slide.imageName));
    }
  }
  await fs.writeFile(file('caribbean-treasure-project.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
}

function collectRefs() {
  const refs = [];
  project.scenes.forEach((scene) => {
    scene.hotspots.forEach((spot) => {
      if (spot.targetSceneId) refs.push(['scene', spot.targetSceneId, `hotspot ${spot.id}`]);
      if (spot.targetCinematicId) refs.push(['cinematic', spot.targetCinematicId, `hotspot ${spot.id}`]);
      if (spot.enigmaId) refs.push(['enigma', spot.enigmaId, `hotspot ${spot.id}`]);
      if (spot.rewardItemId) refs.push(['item', spot.rewardItemId, `hotspot ${spot.id}`]);
      if (spot.requiredItemId) refs.push(['item', spot.requiredItemId, `hotspot ${spot.id}`]);
      (spot.logicRules || []).forEach((rule) => {
        if (rule.targetSceneId) refs.push(['scene', rule.targetSceneId, `rule ${rule.id}`]);
        if (rule.targetCinematicId) refs.push(['cinematic', rule.targetCinematicId, `rule ${rule.id}`]);
        if (rule.enigmaId) refs.push(['enigma', rule.enigmaId, `rule ${rule.id}`]);
        (rule.advancedConditions || []).forEach((cond) => {
          if (cond.sceneId) refs.push(['scene', cond.sceneId, `condition ${cond.id}`]);
          if (cond.enigmaId) refs.push(['enigma', cond.enigmaId, `condition ${cond.id}`]);
          if (cond.itemId) refs.push(['item', cond.itemId, `condition ${cond.id}`]);
          if (cond.hotspotId) refs.push(['hotspot', cond.hotspotId, `condition ${cond.id}`]);
          if (cond.replyId) refs.push(['reply', cond.replyId, `condition ${cond.id}`]);
        });
      });
      (spot.conversation?.nodes || []).forEach((node) => {
        (node.replies || []).forEach((reply) => {
          if (reply.targetSceneId) refs.push(['scene', reply.targetSceneId, `reply ${reply.id}`]);
          if (reply.targetCinematicId) refs.push(['cinematic', reply.targetCinematicId, `reply ${reply.id}`]);
          if (reply.enigmaId) refs.push(['enigma', reply.enigmaId, `reply ${reply.id}`]);
          if (reply.rewardItemId) refs.push(['item', reply.rewardItemId, `reply ${reply.id}`]);
        });
      });
    });
  });
  project.enigmas.forEach((enigma) => {
    if (enigma.targetSceneId) refs.push(['scene', enigma.targetSceneId, `enigma ${enigma.id}`]);
    if (enigma.targetCinematicId) refs.push(['cinematic', enigma.targetCinematicId, `enigma ${enigma.id}`]);
    (enigma.clueSceneIds || []).forEach((sceneId) => refs.push(['scene', sceneId, `clue ${enigma.id}`]));
  });
  project.combinations.forEach((combo) => {
    refs.push(['item', combo.itemAId, `combo ${combo.id}`], ['item', combo.itemBId, `combo ${combo.id}`], ['item', combo.resultItemId, `combo ${combo.id}`]);
  });
  return refs;
}

async function validate() {
  const ids = {
    scene: new Set(project.scenes.map((entry) => entry.id)),
    item: new Set(project.items.map((entry) => entry.id)),
    enigma: new Set(project.enigmas.map((entry) => entry.id)),
    cinematic: new Set(project.cinematics.map((entry) => entry.id)),
    hotspot: new Set(project.scenes.flatMap((scene) => scene.hotspots.map((entry) => entry.id))),
    reply: new Set(project.scenes.flatMap((scene) => scene.hotspots.flatMap((spot) => (spot.conversation?.nodes || []).flatMap((node) => (node.replies || []).map((reply) => reply.id))))),
  };
  const errors = [];
  const assert = (ok, message) => { if (!ok) errors.push(message); };
  assert(project.acts.length === 1, 'Le projet doit avoir 1 acte.');
  assert(project.scenes.length === 15, 'Le projet doit avoir 15 scènes.');
  assert(project.enigmas.length === 4, 'Le projet doit avoir 4 énigmes.');
  assert(project.cinematics.length === 2, 'Le projet doit avoir 2 cinématiques.');
  assert(project.cinematics.every((cine) => cine.slides.length === 3), 'Chaque cinématique doit avoir 3 images.');
  assert(project.items.length === 6, 'Le projet doit avoir 6 objets.');
  assert(project.combinations.length >= 1, 'Le projet doit avoir au moins une combinaison.');
  collectRefs().forEach(([kind, id, source]) => assert(ids[kind]?.has(id), `Référence cassée ${kind}:${id} depuis ${source}`));

  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const enigmaSceneIds = new Map();
  project.scenes.forEach((scene) => {
    scene.hotspots.forEach((spot) => {
      if (spot.enigmaId) {
        if (!enigmaSceneIds.has(spot.enigmaId)) enigmaSceneIds.set(spot.enigmaId, new Set());
        enigmaSceneIds.get(spot.enigmaId).add(scene.id);
      }
    });
  });
  project.enigmas.forEach((enigma) => {
    const hostScenes = enigmaSceneIds.get(enigma.id) || new Set();
    (enigma.clueSceneIds || []).forEach((clueSceneId) => assert(!hostScenes.has(clueSceneId), `Indice dans la même pièce que l’énigme ${enigma.id}: ${clueSceneId}`));
  });

  project.scenes.forEach((scene) => {
    scene.hotspots.filter((spot) => spot.actionType === 'scene' && spot.targetSceneId).forEach((spot) => {
      const target = sceneById.get(spot.targetSceneId);
      const hasReturn = (target?.hotspots || []).some((entry) => entry.actionType === 'scene' && entry.targetSceneId === scene.id);
      assert(hasReturn, `Navigation sans retour: ${scene.id} -> ${spot.targetSceneId}`);
    });
  });

  const media = [
    ...project.scenes.map((scene) => [scene.backgroundData, W, H, false]),
    ...project.cinematics.flatMap((cine) => cine.slides.map((slide) => [slide.imageData, W, H, false])),
    ...project.enigmas.filter((entry) => entry.imageData).map((entry) => [entry.imageData, W, H, false]),
    ...project.items.map((item) => [item.imageData, 512, 512, true]),
  ];
  for (const [publicPath, expectedW, expectedH, needsAlpha] of media) {
    const rel = publicPath.replace(PUBLIC, '').replace(/^\//, '');
    const meta = await sharp(file(rel)).metadata();
    assert(meta.width === expectedW && meta.height === expectedH, `Mauvaises dimensions pour ${publicPath}: ${meta.width}x${meta.height}`);
    if (needsAlpha) assert(meta.hasAlpha, `Objet sans canal alpha: ${publicPath}`);
  }

  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  await fs.writeFile(file('validation-report.json'), `${JSON.stringify({
    ok: true,
    counts: {
      acts: project.acts.length,
      scenes: project.scenes.length,
      enigmas: project.enigmas.length,
      cinematics: project.cinematics.length,
      cinematicSlides: project.cinematics.reduce((sum, cine) => sum + cine.slides.length, 0),
      items: project.items.length,
      combinations: project.combinations.length,
      hotspots: project.scenes.reduce((sum, scene) => sum + scene.hotspots.length, 0),
      logicRules: project.scenes.reduce((sum, scene) => sum + scene.hotspots.reduce((inner, spot) => inner + (spot.logicRules || []).length, 0), 0),
    },
    checked: ['references', 'navigation returns', 'clues outside enigma rooms', 'media dimensions', 'item alpha'],
  }, null, 2)}\n`, 'utf8');
}

await generateAssets();
await validate();
console.log(`Generated ${file('caribbean-treasure-project.json')}`);

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const DEFAULT_SITE_URL = 'https://escape-game-studio.netlify.app';
const LEGACY_SITE_URL = 'https://escape-game-builder.netlify.app';
const rawSiteUrl = process.env.VITE_SITE_URL || process.env.URL || process.env.DEPLOY_URL || DEFAULT_SITE_URL;
const siteUrl = rawSiteUrl.replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

const brandName = 'Escape Game Studio';
const ogImagePath = '/og-image.png';

const absoluteUrl = (path = '/') => {
  if (!siteUrl) return path;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const escapeHtml = (value) => escapeXml(value);

const seoPages = [
  {
    slug: 'creer-un-escape-game',
    title: 'Créer un escape game en ligne sans coder',
    metaDescription: 'Méthode et outil pour créer un escape game interactif en ligne: scènes, énigmes, objets, conditions, test joueur, publication et partage.',
    h1: 'Créer un escape game en ligne sans coder',
    intro: 'Escape Game Studio aide à passer d’une idée de scénario à un parcours jouable: on construit les scènes, on place les interactions, on ajoute les énigmes puis on vérifie le chemin avant de partager le jeu.',
    sections: [
      ['Structurer le parcours', 'Définis les lieux, les objectifs, les objets importants et les étapes de progression avant de laisser les joueurs entrer dans l’expérience.'],
      ['Ajouter les énigmes', 'Codes, choix, inventaire, dialogues, indices et conditions permettent de transformer une suite d’écrans en véritable escape game interactif.'],
      ['Tester avant publication', 'Le mode preview et le bilan de cohérence aident à repérer les liens cassés, les scènes bloquées et les règles qui manquent de clarté.'],
    ],
    faq: [
      ['Puis-je créer un escape game sans développeur ?', 'Oui. Le builder fonctionne en ligne et permet de composer les scènes, les zones cliquables, les énigmes et la logique sans écrire de code.'],
      ['Peut-on publier le jeu ensuite ?', 'Oui. Une version jouable peut être partagée avec les joueurs ou publiée dans la galerie publique.'],
      ['L’IA est-elle obligatoire ?', 'Non. Elle est optionnelle: tu peux tout construire manuellement ou l’utiliser seulement pour accélérer certaines idées.'],
    ],
  },
  {
    slug: 'logiciel-escape-game',
    title: 'Logiciel escape game no-code pour créer et tester un jeu',
    metaDescription: 'Un logiciel escape game en ligne pour concevoir des scènes interactives, tester le parcours joueur, corriger les blocages et publier une version jouable.',
    h1: 'Logiciel escape game no-code',
    intro: 'Le studio rassemble les outils essentiels d’un créateur: édition de scènes, médias, objets, énigmes, logique conditionnelle, simulation joueur, score de projet et export.',
    sections: [
      ['Un espace de production unique', 'Les scènes, l’inventaire, les énigmes, la logique et la prévisualisation restent dans le même environnement pour éviter les allers-retours.'],
      ['Un contrôle qualité intégré', 'Le bilan met en évidence les problèmes de parcours et les incohérences avant que le jeu soit envoyé à un public.'],
      ['Une diffusion simple', 'Quand le jeu est prêt, il peut être testé, partagé, publié ou exporté selon le besoin du projet.'],
    ],
    faq: [
      ['Le logiciel fonctionne-t-il dans un navigateur ?', 'Oui. Escape Game Studio est une application web accessible depuis le navigateur.'],
      ['Faut-il installer un moteur de jeu ?', 'Non. La création et le test se font directement dans le studio.'],
      ['Est-ce adapté aux prototypes ?', 'Oui. Le studio est utile pour prototyper rapidement, tester la logique et améliorer le parcours avant une version finale.'],
    ],
  },
  {
    slug: 'escape-game-pedagogique',
    title: 'Créer un escape game pédagogique interactif',
    metaDescription: 'Crée un escape game pédagogique avec objectifs, consignes, énigmes, progression, test de cohérence et version jouable en ligne.',
    h1: 'Créer un escape game pédagogique',
    intro: 'Pour un cours, une formation ou un atelier, Escape Game Studio permet de transformer des objectifs pédagogiques en mission interactive avec progression, indices et validation.',
    sections: [
      ['Relier jeu et apprentissage', 'Chaque scène peut porter une notion, une consigne, un document, un objet ou une énigme liée à l’objectif pédagogique.'],
      ['Rendre la progression lisible', 'Les conditions, objets et scènes visitées permettent de guider les apprenants sans révéler trop tôt la solution.'],
      ['Tester le scénario', 'Le mode joueur aide à vérifier que les consignes sont compréhensibles et que le parcours reste jouable du début à la fin.'],
    ],
    faq: [
      ['Peut-on créer un escape game pour une classe ?', 'Oui. Le studio convient aux enseignants, formateurs et médiateurs qui veulent préparer une expérience jouable en ligne.'],
      ['Peut-on intégrer des documents ou images ?', 'Oui. Les scènes peuvent utiliser des médias, textes, sons, objets et interactions.'],
      ['Peut-on corriger le parcours avant diffusion ?', 'Oui. Le preview joueur et le bilan de projet servent à repérer les blocages avant de partager le lien.'],
    ],
  },
  {
    slug: 'generateur-enigmes-escape-game',
    title: 'Générateur d’énigmes pour escape game avec IA optionnelle',
    metaDescription: 'Prépare des énigmes d’escape game, ajoute des indices et teste les réponses dans un builder interactif avec IA optionnelle.',
    h1: 'Générateur d’énigmes pour escape game',
    intro: 'Le studio permet de créer des énigmes, de définir les bonnes réponses, de relier les réussites à des objets ou des scènes, puis de tester le résultat comme un joueur.',
    sections: [
      ['Créer des énigmes jouables', 'Codes, validations, choix et règles conditionnelles aident à construire des mécaniques claires plutôt qu’un simple texte à lire.'],
      ['Ajouter des conséquences', 'Une bonne réponse peut donner un objet, ouvrir une scène, lancer une cinématique ou modifier l’état du jeu.'],
      ['Utiliser l’IA avec contrôle', 'L’assistant peut proposer des idées, mais le créateur garde la main sur les réponses, les indices et la difficulté.'],
    ],
    faq: [
      ['L’IA génère-t-elle tout le jeu automatiquement ?', 'Non. Elle aide à produire ou améliorer des idées, mais la structure et la validation restent contrôlées par le créateur.'],
      ['Peut-on tester une réponse ?', 'Oui. Le preview permet de vérifier les énigmes et leurs conséquences dans le parcours joueur.'],
      ['Peut-on combiner énigmes et objets ?', 'Oui. Les objets d’inventaire peuvent servir de récompense, de condition ou d’indice.'],
    ],
  },
  {
    slug: 'escape-game-entreprise',
    title: 'Escape game pour entreprise, formation et animation',
    metaDescription: 'Crée un escape game interactif pour une entreprise, une formation, un événement ou une animation: scénario, parcours, test et lien jouable.',
    h1: 'Créer un escape game pour entreprise',
    intro: 'Escape Game Studio peut servir à préparer un atelier de formation, une animation interne, une mission d’onboarding ou un support de communication interactif.',
    sections: [
      ['Adapter le scénario au contexte', 'Le créateur peut personnaliser le ton, les consignes, les visuels, les objectifs et les sorties vers ses propres supports.'],
      ['Vérifier l’expérience avant usage', 'Le parcours peut être testé en amont pour éviter les impasses, les consignes ambiguës et les enchaînements manquants.'],
      ['Partager simplement', 'Un lien jouable ou une publication permet de diffuser le jeu auprès d’une équipe, d’un client ou d’un public événementiel.'],
    ],
    faq: [
      ['Est-ce adapté à la formation ?', 'Oui. Le studio permet de scénariser une progression et de relier les actions du joueur à des objectifs concrets.'],
      ['Peut-on utiliser ses propres visuels ?', 'Oui. Les scènes et médias peuvent être personnalisés pour correspondre à un contexte d’entreprise ou d’événement.'],
      ['Peut-on faire une version courte ?', 'Oui. Un jeu peut être très simple, avec quelques scènes et énigmes, ou plus complet selon l’objectif.'],
    ],
  },
  {
    slug: 'galerie-escape-games',
    title: 'Galerie d’escape games en ligne',
    metaDescription: 'Découvre des escape games interactifs publiés avec Escape Game Studio et ouvre des exemples jouables dans le navigateur.',
    h1: 'Galerie d’escape games en ligne',
    intro: 'La galerie publique sert à découvrir des créations, tester des parcours joueur et voir ce que le studio peut produire avec scènes, énigmes et interactions.',
    sections: [
      ['Découvrir des jeux publiés', 'Les jeux publics montrent différents univers, formats et niveaux de complexité.'],
      ['Tester côté joueur', 'Chaque expérience jouable donne une vision concrète du rendu final, séparée de l’espace de création.'],
      ['S’inspirer pour créer', 'La galerie aide à imaginer la structure, le rythme et les mécaniques d’un futur projet.'],
    ],
    faq: [
      ['La galerie est-elle publique ?', 'Oui. Les créateurs peuvent publier certains jeux dans une galerie accessible aux visiteurs.'],
      ['Les joueurs ont-ils besoin d’un compte ?', 'Non. Une version jouable publique peut être ouverte sans accéder au builder.'],
      ['Puis-je publier mon propre jeu ?', 'Oui. Après création et test, un projet peut être partagé ou publié selon les options disponibles.'],
    ],
  },
];

const appEntries = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: '1.0',
  },
  {
    path: '/?gallery=1',
    changefreq: 'daily',
    priority: '0.8',
  },
  {
    path: '/conditions-utilisation.html',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/politique-confidentialite.html',
    changefreq: 'yearly',
    priority: '0.3',
  },
];

const sitemapEntries = [
  ...appEntries,
  ...seoPages.map((page) => ({
    path: `/${page.slug}/`,
    changefreq: 'monthly',
    priority: page.slug === 'creer-un-escape-game' ? '0.9' : '0.7',
  })),
];

const sitemapUrls = sitemapEntries.map((entry) => `  <url>
    <loc>${escapeXml(absoluteUrl(entry.path))}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${absoluteUrl('/sitemap.xml')}
`;

const renderSeoPage = (page) => {
  const canonicalUrl = absoluteUrl(`/${page.slug}/`);
  const internalLinks = seoPages
    .filter((linkPage) => linkPage.slug !== page.slug)
    .map((linkPage) => `<a href="/${linkPage.slug}/">${escapeHtml(linkPage.title)}</a>`)
    .join('');
  const faqs = page.faq.map(([question, answer]) => `
          <details>
            <summary>${escapeHtml(question)}</summary>
            <p>${escapeHtml(answer)}</p>
          </details>`).join('');
  const sections = page.sections.map(([heading, text]) => `
        <section>
          <h2>${escapeHtml(heading)}</h2>
          <p>${escapeHtml(text)}</p>
        </section>`).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: brandName,
        url: absoluteUrl('/'),
        logo: absoluteUrl(ogImagePath),
      },
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: page.title,
        description: page.metaDescription,
        inLanguage: 'fr-FR',
        isPartOf: {
          '@id': `${siteUrl}/#website`,
        },
        publisher: {
          '@id': `${siteUrl}/#organization`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Accueil',
            item: absoluteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: page.title,
            item: canonicalUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: page.faq.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: answer,
          },
        })),
      },
    ],
  };

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)} | ${brandName}</title>
    <meta name="description" content="${escapeHtml(page.metaDescription)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.metaDescription)}" />
    <meta property="og:site_name" content="${brandName}" />
    <meta property="og:image" content="${absoluteUrl(ogImagePath)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.metaDescription)}" />
    <meta name="twitter:image" content="${absoluteUrl(ogImagePath)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      :root {
        color-scheme: dark;
        --bg: #071121;
        --panel: #0d1b31;
        --line: rgba(147, 197, 253, 0.24);
        --text: #e5eefc;
        --muted: #a8b8d6;
        --accent: #93c5fd;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Arial, sans-serif;
        line-height: 1.65;
        color: var(--text);
        background: radial-gradient(circle at top left, rgba(37, 99, 235, .18), transparent 34rem), var(--bg);
      }

      main {
        width: min(960px, calc(100% - 32px));
        margin: 0 auto;
        padding: 40px 0 72px;
      }

      header,
      section,
      .cta,
      .links {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: rgba(13, 27, 49, .9);
      }

      header {
        padding: 30px;
      }

      section,
      .cta,
      .links {
        margin-top: 18px;
        padding: 24px;
      }

      nav,
      .actions,
      .links div {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      h1,
      h2 {
        margin: 0 0 10px;
        color: #ffffff;
        line-height: 1.15;
      }

      h1 {
        font-size: clamp(2.2rem, 6vw, 4rem);
      }

      p {
        margin: 0;
        color: var(--muted);
      }

      a {
        color: var(--accent);
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 9px 14px;
        border: 1px solid rgba(147, 197, 253, .34);
        border-radius: 999px;
        background: rgba(37, 99, 235, .18);
        color: #f8fbff;
        font-weight: 700;
        text-decoration: none;
      }

      details {
        margin-top: 10px;
        padding: 14px 0 0;
        border-top: 1px solid rgba(147, 197, 253, .18);
      }

      summary {
        cursor: pointer;
        color: #ffffff;
        font-weight: 700;
      }

      footer {
        margin-top: 26px;
        color: var(--muted);
        font-size: .94rem;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <nav aria-label="Navigation principale">
          <a href="/">Accueil</a>
          <a href="/?gallery=1">Galerie</a>
          <a href="/conditions-utilisation.html">Conditions</a>
          <a href="/politique-confidentialite.html">Confidentialité</a>
        </nav>
        <h1>${escapeHtml(page.h1)}</h1>
        <p>${escapeHtml(page.intro)}</p>
        <div class="actions" style="margin-top: 18px;">
          <a class="button" href="/">Essayer Escape Game Studio</a>
          <a class="button" href="/?gallery=1">Voir la galerie</a>
        </div>
      </header>
${sections}
      <section>
        <h2>Questions fréquentes</h2>
${faqs}
      </section>
      <aside class="links" aria-label="Pages liées">
        <h2>Explorer les autres usages</h2>
        <div>${internalLinks}</div>
      </aside>
      <aside class="cta">
        <h2>Prêt à construire ton parcours ?</h2>
        <p>Ouvre le studio, lance la démo ou crée un compte pour sauvegarder et publier tes jeux.</p>
        <div class="actions" style="margin-top: 16px;">
          <a class="button" href="/">Ouvrir le studio</a>
          <a class="button" href="/?gallery=1">Découvrir des exemples</a>
        </div>
      </aside>
      <footer>
        ${brandName} - création, test et publication d’escape games interactifs en ligne.
      </footer>
    </main>
  </body>
</html>
`;
};

await mkdir(distDir, { recursive: true });
await writeFile(resolve(distDir, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(resolve(distDir, 'robots.txt'), robots, 'utf8');

await Promise.all(seoPages.map(async (page) => {
  const pageDir = resolve(distDir, page.slug);
  await mkdir(pageDir, { recursive: true });
  await writeFile(resolve(pageDir, 'index.html'), renderSeoPage(page), 'utf8');
}));

if (siteUrl) {
  const indexPath = resolve(distDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  await writeFile(
    indexPath,
    indexHtml
      .replaceAll(LEGACY_SITE_URL, siteUrl)
      .replaceAll(DEFAULT_SITE_URL, siteUrl)
      .replace(/<link\s+rel="canonical"\s+href="\/"\s+data-seo-canonical(?:\s+vite-ignore)?\s*\/?>/, `<link rel="canonical" href="${absoluteUrl('/')}" data-seo-canonical />`)
      .replace(/<meta\s+property="og:url"\s+content="\/"\s+data-seo-og-url\s*\/?>/, `<meta property="og:url" content="${absoluteUrl('/')}" data-seo-og-url />`)
      .replaceAll('content="/og-image.png"', `content="${absoluteUrl('/og-image.png')}"`),
    'utf8',
  );
}

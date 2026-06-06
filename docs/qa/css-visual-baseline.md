# Baseline visuelle CSS

Cette baseline fige le rendu des vues critiques avant les refactors CSS. Elle ne refactore aucun style et sert uniquement de garde-fou Playwright.

## Vues couvertes

- Builder: shell principal du studio, onglet scenes.
- Scene: editeur de scene et canvas.
- Preview player: joueur public charge depuis un projet publie.
- Galerie: galerie publique.
- Page jeu publique: route `gallery=1&game=...`.
- Page createur publique: route `gallery=1&creator=...`.
- Profil: espace createur/profil.
- IA: onglet IA du builder.

## Viewports

- Desktop: 1440 x 900.
- Mobile portrait: 390 x 844.
- Mobile paysage: 844 x 390.

## Commandes

Generer ou mettre a jour les snapshots:

```powershell
npx playwright test tests/e2e/css-visual-baseline.spec.js --update-snapshots --workers=1
```

Valider la baseline sans changer les snapshots:

```powershell
npx playwright test tests/e2e/css-visual-baseline.spec.js --workers=1
```

Forcer un port local si besoin:

```powershell
$env:PLAYWRIGHT_PORT=5194
npx playwright test tests/e2e/css-visual-baseline.spec.js --workers=1
```

Le serveur de test est lance par `playwright.config.js` via `npm run dev:ui`. Les snapshots sont stockes par Playwright a cote de la spec, dans le dossier `tests/e2e/css-visual-baseline.spec.js-snapshots`.

## Notes de validation

- La spec injecte un etat local deterministic pour eviter de dependre des donnees du navigateur.
- Les appels IA externes et la session Supabase de test sont stubbes pour stabiliser les vues privees.
- Les animations et le caret sont masques pendant la comparaison.
- Les vues desktop, mobile portrait et mobile paysage doivent rester visuellement equivalentes apres chaque petite PR CSS.

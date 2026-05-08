# Mode d'emploi détaillé - Escape Game Builder

Ce mode d'emploi explique comment créer, tester, partager et publier un escape game avec l'application en ligne. Il suit les écrans et les champs visibles dans le builder.

## 1. Utiliser l'écran Profil

L'écran **Profil** est le tableau de bord de tes projets.

### Créer un nouveau projet

1. Dans **Nouveau projet**, écris le nom de ton escape game.
2. Choisis un template :
   - **Projet vide** : démarre avec une base minimale.
   - **Manoir hanté** : prépare un univers de manoir.
   - **Enquête policière** : prépare une structure d'investigation.
   - **Laboratoire** : prépare une ambiance scientifique.
   - **Musée** : prépare une aventure autour d'artefacts.
3. Clique sur **Créer**.

Le template donné une première structure, mais tu peux tout modifiér ensuite.

### Gérer les projets existants

Dans **Mes projets**, chaque projet peut être :

- **ouvert** pour reprendre l'édition ;
- **renommé** pour corriger son titre ;
- **dupliqué** pour créer une variante sans perdre l'original ;
- **supprimé** si tu n'en as plus besoin ;
- **testé** pour lancer rapidement sa version jouable ;
- **partagé** avec un lien ;
- **publié** dans la galerie publique.

La suppression est définitive. Exporte un JSON avant de supprimer si tu veux garder une sauvegarde.

### Importer un projet JSON

Le bouton **Importer un projet JSON** sert à récupérer un projet précédemment exporté.

Utilise cette fonction pour :

- restaurer une sauvegarde ;
- transférer un jeu depuis un autre compte ou appareil ;
- reprendre un projet archivé ;
- tester une version reçue de quelqu'un.

Après import, ouvre le projet et vérifie-le dans **Preview**.

## 2. Barre supérieure du builder

Quand un projet est ouvert, la barre supérieure affiché les actions globales.

- **Exporter JSON** : télécharge une sauvegarde complète du projet. C'est le fichier de travail.
- **Importer JSON** : charge un projet JSON depuis ton ordinateur.
- **Exporter jeu** : génère une version prête à jouer, séparée du builder.
- **Statut de sauvegarde** : indique si le projet est sauvegardé, en cours de synchronisation, local ou en erreur.
- **Déconnexion** : quitte le compte actif.

Différence importante :

- Le **JSON** sert à continuer l'édition dans le builder.
- L'**export jeu** sert à donner une version jouable à des joueurs.

## 3. Méthode recommandée pour créer un jeu

Pour éviter de se perdre, construis ton jeu dans cet ordre :

1. Crée les sc?nes principales.
2. Ajoute les images et effets dans **Média**.
3. Place les objets visibles et les zones cliquables dans **Sc?nes**.
4. Crée les objets d'inventaire.
5. Crée les énigmes.
6. Relie les énigmes aux zones d'action.
7. Ajoute les cinématiques.
8. Prépare les animations 2D dans **Animation** si ton jeu en utilise.
9. Crée les combinaisons d'objets.
10. Ajoute les règles avancées dans **Logique**.
11. Dessine le parcours dans **Plan**.
12. Teste du début à la fin dans **Preview**.
13. Corrige avec **Bilan**.
14. Publie ou exporte.

## 4. Onglet Sc?nes

L'onglet **Sc?nes** sert à construire les lieux du jeu et les interactions placées dessus.

### Champs principaux d'une scene

**Nom de la scene**  
Nom affiché dans la navigation de l'éditeur et dans les listes de choix. Garde-le court et explicite, surtout si plusieurs sc?nes se ressemblent.

Exemples :

- `Hall d'entrée`
- `Bureau fermé`
- `Gros plan du coffre`
- `Sous-sol - porte rouge`

**Acte**  
Regroupe la sc?ne dans un chapitre. Si tu changes l'acte d'une scene, une sc?ne parente incompatible peut être retirée.

Utilise les actes pour séparer :

- introduction ;
- exploration ;
- révélation ;
- final.

**Sc?ne parente**  
Transforme la sc?ne en sous-sc?ne d'une autre. C'est utile pour les gros plans, tiroirs, portes, documents, coffres, placards ou variantes d'une même pièce.

Exemple :

- Sc?ne principale : `Bureau`
- Sous-sc?nes : `Tiroir du bureau`, `Coffre mural`, `Tableau retourné`

**Texte d'introduction**  
Texte montré à l'entrée de la scene, avant que le joueur interagisse. Il pose l'ambiance ou l'objectif local.

Bon exemple :

> La pièce sent la poussière et l'encre sèche. Le bureau semble avoir été fouillé à la hâte.

Mauvais exemple :

> Trouve le code 4821 dans le tiroir.

Le deuxième donné trop directement la solution.

### Objets d'inventaire

Un objet d'inventaire est ce que le joueur peut obtenir, garder, utiliser ou combiner.

Champs importants :

- **Nom de l'objet** : libellé visible par le joueur quand il obtient ou consulte l'objet.
- **Image de l'objet** : miniature affichée dans l'inventaire.
- **Emoji de secours** : symbole utilisé si aucune image n'est fournie.

Exemples :

- `Clé rouillée`
- `Carte magnétique`
- `Fragment de photo`
- `Pile électrique`
- `Badge laboratoire`

Conseil : un objet doit avoir une utilité claire. Si un objet ne sert jamais, il risque de distraire inutilement le joueur.

### Objets visibles dans une scene

Un objet visible est placé directement sur l'image de la scene. Il peut être cliquable, inspecté, ramassé ou les deux.

Champs importants :

- **Nom** : nom interne pour retrouver l'objet dans les calques et les listes.
- **X** : position horizontale du centre, en pourcentage de la largeur de l'image. `0` = bord gauche, `100` = bord droit.
- **Y** : position verticale du centre, en pourcentage de la hauteur de l'image. `0` = haut, `100` = bas.
- **Largeur** : largeur de la zone cliquable et de l'image visible, en pourcentage.
- **Hauteur** : hauteur de la zone cliquable et de l'image visible, en pourcentage.
- **Image visible** : image affichée dans la sc?ne à l'emplacement choisi.
- **Image pop-up** : image montrée en grand quand le joueur inspecte l'objet.
- **Mode d'interaction** : définit si le clic montre un pop-up, ajoute un objet à l'inventaire, ou fait les deux.
- **Objet d'inventaire lié** : objet ajouté à l'inventaire si le mode inclut l'inventaire.
- **Dialogue** : texte affiché lors de l'interaction.

Modes d'interaction :

- **Pop-up uniquement** : le joueur inspecte un détail, comme une lettre ou une photo.
- **Inventaire uniquement** : le joueur ramasse directement un objet.
- **Pop-up + inventaire** : le joueur inspecte puis obtient l'objet.

Conseil : sur mobile, évite les objets trop petits. Une largeur ou hauteur trop faible rend l'interaction difficile.

### Zones d'action

Une zone d'action est une zone cliquable invisible ou semi-visible. Elle déclénche une action après validation des prérequis éventuels.

Champs importants :

- **Nom** : nom interne qui décrit l'intention, par exemple `Porte verrouillée`.
- **X** et **Y** : position du centre de la zone en pourcentage.
- **Largeur** et **Hauteur** : taille de la zone cliquable.
- **Action** : action principale déclénchée.
- **Dialogue** : réaction, indice ou confirmation affichée au joueur.
- **Sc?ne cible** : destination si l'action est un changement de scene.
- **Cinématique cible** : cinématique lancée après interaction.
- **Énigme liée** : énigme à résoudre avant d'exécuter l'action de la zone.
- **Son de la zone** : son joué au moment où la zone est utilisée.
- **Image objet** : image associée à l'action, souvent utilisée pour montrer un objet trouvé ou un indice.

Actions typiques :

- afficher un dialogue ;
- donner un objet ;
- afficher un dialogue puis donner un objet ;
- changer de sc?ne ;
- lancer une cinématique ;
- ouvrir une énigme.

Exemples :

- `Porte cave` : demande une clé, puis ouvre la sc?ne `Cave`.
- `Tableau étrange` : affiché un indice.
- `Coffre mural` : ouvre l'énigme `Code du coffre`.
- `Radio cassée` : joué un son puis donné une information.

### Deuxième action

Une zone peut avoir un comportement différent après une première utilisation.

Exemple :

- Premier clic sur `Tiroir` : donné `Clé rouillée`.
- Deuxième clic : affiché `Le tiroir est vide maintenant.`

Cette logique évite qu'un joueur récupère plusieurs fois le même objet.

### Effets visuels de zone

Une sc?ne peut contenir des zones d'effet visuel localisées.

Champs importants :

- **Nom** : nom interne de la zone d'effet.
- **Effet** : effet affiché uniquement dans cette zone.
- **Intensité** : force de l'effet.
- **Profondeur** : détermine si l'effet passe derrière les objets, entre les objets et les zones, ou au-dessus de tout.
- **X**, **Y**, **Largeur**, **Hauteur** : position et taille de la zone visuelle.

Utilise-les pour attirer l'attention sans casser l'immersion : lumière sur un coffre, fumée devant une porte, étincelles sur un mécanisme.

## 5. Onglet Média

L'onglet **Média** centralise les images, sons, transitions, effets et minuteurs d'une scene.

### Sélection de scene

**Scene**  
Choisis la sc?ne dont tu veux régler les images, sons et effets.

### Image et ambiance

**Image de fond**  
Image principale vue par le joueur dans cette scene. Elle doit être lisible et assez nette pour que les zones importantes soient compréhensibles.

**Effet global**  
Filtre ou effet appliqué à toute la scene. Exemples : pluie, brouillard, neige, glitch, vision nocturne, film noir.

**Intensité globale**  
Force du filtre ou de l'effet global. Si l'effet gêne la lecture des indices, baisse l'intensité.

### Transitions

**Transition de sortie**  
Transition jouée quand le joueur quitte cette sc?ne vers une autre scene.

Types possibles :

- aucune ;
- fondu ;
- flou ;
- dissolution ;
- glissement ;
- volet ;
- zoom ;
- iris ;
- flip ;
- rotation ;
- rideau ;
- bandes cinéma ;
- glitch ;
- pixel ;
- flash.

**Durée**  
Vitesse de la transition : rapide, normale, lente ou très lente.

**Sc?ne d'arrivée test**  
Sc?ne utilisée uniquement pour rejouer la transition dans l'aperçu Média. Cela ne change pas la vraie logique du jeu.

### Minuteur de scene

Un minuteur ajoute une contrainte de temps à une scene.

Champs importants :

- **Durée** : temps disponible dans cette sc?ne avant action automatique.
- **Fin du temps** : action déclénchée à zéro.
- **Sc?ne cible** : sc?ne ouverte à la fin du temps ou quand les vies tombent à zéro.
- **Cinématique cible** : cinématique lancée automatiquement.
- **Vies perdues** : nombre de vies retirées. Le joueur commence avec 3 vies dans l'aperçu.
- **Message de fin** : texte affiché si l'action de fin a besoin d'un message.

Actions possibles :

- rien ;
- aller à une sc?ne ;
- relancer cette sc?ne ;
- recommencer le jeu ;
- perdre des vies ;
- afficher un message ;
- lancer une cinématique.

Utilise un minuteur seulement si la prèssion sert le jeu. Un compte à rebours gratuit peut frustrer le joueur.

## 6. Onglet Plan

L'onglet **Plan** sert à représenter le parcours du joueur et à vérifier les liaisons entre sc?nes.

### Pièces

Une pièce représente un lieu ou une étape du parcours. Elle peut être liée à une scene.

Actions utiles :

- **Ajouter une pièce** : crée une pièce manuellement.
- **Ajouter les sc?nes manquantes** : crée automatiquement des pièces pour les sc?nes non placées.
- **Relier** : crée une liaison entre deux pièces.
- **Supprimer** : supprime une pièce et ses liaisons.

Champs d'une pièce :

- **Nom** : nom affiché sur le plan.
- **Sc?ne liée** : sc?ne du builder associée à cette pièce.
- **Type** : pièce normale, départ ou arrivée.

Le plan accepte un seul départ principal. Si tu définis une nouvelle pièce comme départ, l'ancienne redevient normale.

### Notes de parcours

Utilise **Notes de parcours** pour écrire :

- conditions d'accès ;
- ordre prévu ;
- passages optionnels ;
- pièges de connexion ;
- sc?nes à sens unique ;
- remarques de test.

### Vérification des liaisons

Le plan compare les liaisons dessinées avec les vraies transitions du jeu.

Une liaison peut être :

- **valide** : les zones d'action permettent bien de passer entre les sc?nes ;
- **partielle** : un seul sens existe ;
- **manquante** : le plan montre une liaison qui n'existe pas encore dans les zones ;
- **acceptée en aller simple** : tu confirmes volontairement qu'un retour n'est pas prévu.

Si le plan signale une liaison manquante, retourne dans **Sc?nes** et ajoute une zone d'action vers la bonne scene.

## 7. Onglet Cinématiques

Les cinématiques servent d'introduction, transition, révélation, récompense ou conclusion.

### Démarrage du jeu

**Le jeu commence par**  
Détermine le premier écran du joueur : une sc?ne jouable ou une cinématique d'introduction.

**Sc?ne de départ**  
Sc?ne ouverte au début si le démarrage est réglé sur une scene.

**Cinématique de départ**  
Cinématique jouée au début si le démarrage est réglé sur une cinématique.

### Créer une cinématique

**+ Cinématique**  
Crée une nouvelle cinématique. Elle peut ensuite être appelée depuis une zone d'action, une énigme ou le démarrage du jeu.

Champs importants :

- **Nom de la cinématique** : nom interne visible dans les listes de choix.
- **Type de cinématique** : diaporama de slides ou vidéo importée.

### Type vidéo

**Fichier vidéo**  
Fichier joué par la cinématique. Le format MP4 est le plus fiable.

**Lecture auto**  
Lance automatiquement la vidéo au démarrage de la cinématique. Certains navigateurs bloquént l'audio tant que le joueur n'a pas interagi.

**Afficher les contrôles**  
Affiche lecture, pause, barre de progression et volume.

### Type slides

Chaque slide peut contenir :

- **Image** : pose une ambiance, montre un indice ou illustre une transition.
- **Narration** : texte affiché avec le slide.
- **Son** : audio ou voix associée au slide.

La narration doit être courte. Une cinématique doit rythmer le jeu, pas remplacer toutes les interactions.

### Action de fin

**Action de fin**  
Action déclénchée quand la cinématique se terminé.

Possibilités :

- rester sur place ;
- aller à un acte ;
- ouvrir une sc?ne ;
- donner un objet.

Champs liés :

- **Acte de destination** : utile pour passer à un nouveau chapitre.
- **Sc?ne de destination** : sc?ne ouverte après la cinématique.
- **Objet donné** : objet ajouté à l'inventaire à la fin.

## 8. Onglet Animation

L'onglet **Animation** sert à préparer une sc?ne animée en 2D : tu importes des images, tu les places sur un décor, tu leur appliques une animation, puis tu construis une petite séquence avec une timeline. Il est utile pour créer un plan vivant, une apparition de personnage, une révélation visuelle, une courte transition ou une image animée à exporter.

### Barre de menus

La barre du haut regroupe les actions principales :

- **Fichier** : importer une image, importer un JSON, sauvegarder le brouillon, exporter le JSON, enregistrer l'image sélectionnée ou repartir sur un nouveau brouillon.
- **Editer** : annuler, rétablir, dupliquer un calque, changer son ordre, verrouiller ou supprimer le calque sélectionné.
- **Affichage** : zoomer, dézoomer, réinitialiser la vue ou lancer la lecture.
- **Image** : détourer, gommer, restaurer, rogner ou revenir à l'image originale.
- **Animation** : appliquer un prèset d'animation au calque sélectionné.

Le bouton **Nouveau projet** remet l'animation à zéro. Un message d'avertissement confirme que le projet en cours sera supprimé avant d'effacer le brouillon.

### Sauvegarde et brouillon

**Sauvegarder** enregistre le brouillon de l'animation. Le brouillon est restauré automatiquement quand tu reviens dans l'onglet, ce qui évite de perdre une composition en cours.

Utilise **Exporter JSON** pour garder une version portable de l'animation ou la transférer sur un autre appareil. Utilise **Importer JSON** pour reprendre une animation exportée.

Conseil : sauvegarde avant une grosse retouche d'image ou avant de remplacer plusieurs calques.

### Storyboard

Le panneau **Storyboard** contient les étapes de la séquence.

**Ajouter une étape** crée un nouveau moment sur la timeline. Chaque étape indique :

- le temps de départ ;
- la durée ;
- l'action image ;
- le texte ou la narration associée.

Une étape peut afficher une image, remplacer une image déjà visible ou piloter une partie de la scene. Garde les étapes courtes pour que la lecture reste lisible.

Exemple :

1. `0.0s` : afficher le décor.
2. `3.0s` : faire apparaître un personnage.
3. `7.0s` : révéler un indice.
4. `11.0s` : remplacer l'image par une version plus dramatique.

### Canvas

Le **Canvas** est la zone de composition. Tu peux y déplacer les calques visuellement, ajuster leur taille et vérifier leur rendu sur le décor.

Commandes utiles :

- **Lecture** : joué la séquence.
- **Annuler / rétablir** : revient sur les dernières modifications.
- **Zoom** : agrandit ou réduit la vue de travail.
- **Réinitialiser la vue** : replace le canvas dans une vue confortable.

Clique sur un calque pour le sélectionner, puis utilise l'inspecteur à droite pour le régler précisément.

### Calques et images

Chaque image importée devient un calque. Un calque peut représenter un personnage, un objet, une lumière, un indice ou un élément de décor.

Champs importants :

- **Nom** : nom interne du calque.
- **X (%)** : position horizontale du centre.
- **Y (%)** : position verticale du centre.
- **Taille (%)** : taille du calque sur le canvas.
- **Opacité (%)** : transparence.
- **Durée (ms)** : vitesse de l'animation du calque.
- **Délai (ms)** : retard avant le début de l'animation.
- **Bouclér l'animation** : répète l'animation en continu.

L'ordre des calques détermine ce qui passe devant ou derrière. Place les fonds et ombres en bas, les personnages et objets importants au-dessus.

### Verrouiller un calque

Le verrouillage empêche de déplacer ou modifiér accidentellement une image. Utilise-le quand un élément est bien placé, surtout pour les grands fonds ou les décors.

Un calque verrouillé reste visible, mais il ne se retouche pas tant qu'il n'est pas déverrouillé.

### Presets d'animation

Les prèsets donnént rapidement du mouvement à un calque :

- **Aucun** : image fixe.
- **Respiration** : mouvement léger, utile pour un personnage.
- **Flottement** : mouvement doux vers le haut et le bas.
- **Tremblement** : secousse courte pour surprise, peur ou impact.
- **Clignotement** : variation d'opacité.
- **Apparition** : entrée progressive avec zoom et fondu.
- **Parle** : micro-mouvement pour accompagner un dialogue.
- **Aura** : effet de halo pour un objet magique ou important.
- **Braises** : effet chaud et vivant sur un élément lumineux.
- **Regard** : léger balancement pour une silhouette ou un personnage.

Choisis un prèset selon l'intention narrative. Un indice peut clignoter doucement, mais un personnage principal sera souvent plus naturel avec **Respiration** ou **Regard**.

### Retouche d'image

Le menu **Image** permet de corriger un calque sans quitter l'éditeur.

Fonctions disponibles :

- **Détourage remove.bg** : retire le fond avec le service remove.bg si la configuration est disponible.
- **Détourage IA local** : tente un détourage directement dans le navigateur.
- **Gommer** : efface une partie de l'image.
- **Restaurer** : récupère une zone depuis l'image originale.
- **Rogner** : recadre l'image.
- **Revenir à l'original** : annule les retouches du calque sélectionné.

Conseil : duplique un calque avant une retouche risquée. Tu gardes ainsi une version de secours.

### Inspecteur

L'**Inspecteur** affiché les réglages du calque sélectionné.

Utilise-le pour :

- verrouiller ou déverrouiller l'image ;
- modifiér l'ordre du calque ;
- corriger précisément X, Y, taille et opacité ;
- régler durée, délai et bouclé ;
- activer les outils de gommage, restauration ou rognage.

Si rien n'est sélectionné, clique d'abord sur un calque dans le canvas ou dans la scene.

### Prévisualiser

Le bouton **Prévisualiser** ouvre une lecture de l'animation. Utilise-le pour vérifier :

- le rythme des étapes ;
- l'ordre d'apparition des images ;
- la lisibilité du texte ;
- la cohérence des mouvements ;
- les problèmes de calques qui passent devant ou derrière au mauvais moment.

Teste toujours la prévisualisation avant d'exporter ou de considérer l'animation terminée.

### Bonnes pratiques

- Donné des noms clairs aux calques : `Personnage robe rouge`, `Indice tiroir`, `Ombre porte`.
- Limite le nombre d'animations fortes en même temps.
- Utilise les mouvements subtils pour garder une ambiance professionnelle.
- Verrouille les calques terminés.
- Sauvegarde souvent le brouillon.
- Exporte un JSON quand une version fonctionne bien.

## 9. Onglet Combinaisons

Les combinaisons créent des recettes d'inventaire. Le joueur combine deux objets pour obtenir un résultat.

**+ Combinaison**  
Crée une nouvelle recette.

Champs importants :

- **Objet 1** : premier objet nécessaire.
- **Objet 2** : deuxième objet nécessaire.
- **Résultat** : objet obtenu quand la combinaison réussit.
- **Message affiché** : texte montré après la réussite.

Exemple :

- Objet 1 : `Pile`
- Objet 2 : `Lampe torche`
- Résultat : `Lampe allumée`
- Message : `Là lampe fonctionne. Tu peux maintenant explorer les zones sombres.`

Conseil : évite les recettes ambiguës. Si deux objets peuvent logiquement créer plusieurs résultats, clarifie avec les noms ou les messages.

## 10. Onglet Énigmes

L'onglet **Énigmes** crée les défis que le joueur doit résoudre.

### Liste des énigmes

**Énigme à configurer**  
Liste des énigmes du projet. Sélectionne une énigme pour modifiér sa question, sa solution et ce qu'elle débloqué.

**+ Énigme**  
Crée une nouvelle énigme. Elle devra ensuite être liée à une zone d'action dans l'éditeur de sc?ne pour être jouable.

### Champs communs

**Nom**  
Nom interne de l'énigme. Il sert à la retrouver dans les listes et dans les choix de zones d'action.

**Type**  
Détermine l'interface joueur : code à saisir, combinaison de couleurs, puzzle d'image ou mécanique diverse.

**Question / consigne**  
Consigne affichée au joueur. Elle doit expliquer quoi faire sans forcément donner la solution.

**Message de réussite**  
Texte affiché quand le joueur réussit. Idéal pour confirmer la découverte ou donner un nouvel indice.

**Message d'échec**  
Texte affiché quand la réponse est incorrecte. Il peut guider sans révéler directement la solution.

**Débloqué**  
Action déclénchée après réussite :

- rien de spécial ;
- ouvrir une sc?ne ;
- lancer une cinématique.

**Sc?ne à débloquér**  
Sc?ne rendue accessible après réussite si le déblocage choisi est une scene.

**Cinématique à lancer**  
Cinématique lancée après réussite si le déblocage choisi est une cinématique.

### Type Code lettrès / chiffres

Le joueur saisit une réponse exacte.

**Solution**  
Réponse exacte attendue. Tu peux utiliser chiffres, lettrès ou mélange court.

**Forme côté joueur**  
Apparence visuelle du code. La solution reste la même, seule l'interface change.

Formes disponibles :

- roulettes de coffre-fort ;
- panneau digicode ;
- cases séparées ;
- bande papier / ticket.

Exemples de solutions :

- `4821`
- `LUNE`
- `A17`
- `ORION`

### Type Combinaison de couleurs

Le joueur reproduit une suite ou applique une logique de couleurs.

**Mode de jeu**  
Détermine comment le joueur découvre ou vérifie la combinaison.

Modes possibles :

- suite à reproduire ;
- code fixe ;
- position + couleur ;
- logique Mastermind ;
- indices cachés dans l'environnement ;
- couleurs vers chiffres ou lettrès ;
- couleurs + timing ;
- mélange de couleurs.

**Combinaison gagnante**  
Suite de couleurs à reproduire. L'ordre est important.

Couleurs disponibles :

- rouge ;
- bleu ;
- vert ;
- jaune ;
- violet ;
- orange ;
- blanc ;
- noir.

### Type Puzzle d'image

Le joueur résout une énigme à partir d'une image découpée ou révélée.

**Mode image**  
Détermine la mécanique principale :

- puzzle avec zones cliquables ;
- révélation progressive ;
- puzzle classique.

**Format de découpe**  
Détermine la forme visuelle du découpage :

- lignes droites ;
- pièces de puzzle ;
- papier déchiré ;
- papier chiffonné ;
- éclats irréguliers ;
- bandes verticales.

**Image source**  
Image utilisée comme base pour le puzzle.

**Nombre de lignes**  
Plus il y en a, plus l'énigme devient difficile.

**Nombre de colonnes**  
Plus il y en a, plus le joueur manipule de pièces.

Conseil : pour un premier jeu, commence avec `3 x 3`. Augmente seulement si l'image est très lisible.

### Type Divers

Le type **Divers** regroupe plusieurs mécaniques.

**Mode Divers**  
Détermine si l'énigme attend une réponse libre ou propose plusieurs choix.

Modes disponibles :

- question / réponse ;
- choix entre réponses ;
- vrai / faux ;
- remettre dans l'ordre ;
- association par paires ;
- mot à trous ;
- nombre approximatif ;
- plusieurs bonnes réponses ;
- réponses alternatives acceptées ;
- objet à sélectionner ;
- nombre exact.

Champs selon le mode :

- **Solution attendue** : réponse correcte principale.
- **Choix proposés** : liste utilisée comme choix, ordre attendu ou réponses sélectionnables.
- **Minimum accepté** et **Maximum accepté** : plage numérique acceptée.
- **Objet attendu** : objet que le joueur doit sélectionner.
- **Paires attendues** : associations correctes.
- **Bonnes réponses** : réponses valides pour les modes à choix multiples.

### Fond de pop-up

Une énigme peut avoir une image de fond dédiée.

**Fond de pop-up**  
Image affichée derrière le contenu de la pop-up joueur.

**Zoom**  
Niveau de recadrage de l'image.

**Horizontal** et **Vertical**  
Position de l'image derrière la zone d'écriture.

**Voile de lisibilité**  
Intensité du voile sombre placé sur l'image pour garder le texte lisible.

Utilise un fond de pop-up pour donner du style à une énigme importante, mais vérifie que la consigne reste facile à lire.

## 11. Onglet Logique

L'onglet **Logique** permet de remplacer ou compléter le comportement normal des zones selon l'état de la partie.

### Sélectionner une scene

**Sc?ne à configurer**  
Choisis la sc?ne dont tu veux régler les conditions. Les règles affichées ne concernent que cette scene.

### Zones d'action

**Zones d'action**  
Zones cliquables de la sc?ne sélectionnée. Une règle conditionnelle peut remplacer leur action normale selon l'état de la partie.

**Ajouter une règle**  
Ajoute une condition spéciale sur une zone. La règle s'active seulement si sa condition est vraie pendant la partie.

### Conditions possibles

Une règle peut dépendre de :

- le joueur possède un objet ;
- le joueur ne possède pas un objet ;
- une zone d'action est franchie entièrement ;
- une énigme est réussie ;
- une cinématique est lancée ;
- une combinaison est réalisée ;
- le joueur clique une deuxième fois sur la même zone.

### Actions possibles

Une règle peut décléncher :

- l'action normale de la zone ;
- un dialogue ;
- un dialogue + objet ;
- un changement de sc?ne ;
- une cinématique.

### Options utiles

**Retirer l'objet requis**  
Retire l'objet testé de l'inventaire après activation. Utile pour une clé utilisée une seule fois, un ticket donné ou une pile consommée.

**Désactiver après usage**  
Désactive cette règle après sa première activation. Utile pour ouvrir une porte une fois, puis laisser la zone suivre sa logique normale.

**Objets visibles**  
Objets placés directement dans l'image de la scene. Leur comportement peut être réglé ici sans passer par les zones d'action.

**Cacher l'objet visible**  
Cache l'objet dans la sc?ne après son utilisation. Pratique pour un objet ramassé ou un élément qui disparaît.

Exemple de règle :

- Condition : le joueur possède `Clé rouillée`.
- Action : changer de sc?ne vers `Cave`.
- Option : retirer l'objet requis.
- Résultat : la clé ouvre la porte puis disparaît de l'inventaire.

## 12. Onglet IA

L'onglet **IA** aide à générer, continuer ou enrichir un projet.

### Champs de génération

**Mode**  
Choisit le type d'aide IA : créer un récit complet, avancer acte par acte, continuer un projet existant ou améliorer une sc?ne précise.

**Thème**  
Thème principal de l'histoire : manoir, station spatiale, enquête policière, laboratoire, musée, etc.

**Difficulté**  
Influence la complexité des énigmes, le nombre de dépendances et les conditions de déblocage.

**Actes**  
Grandes parties de l'histoire. Un acte contient plusieurs sc?nes.

**Sc?nes**  
Nombre de sc?nes principales à générer.

**Sous-sc?nes**  
Nombre de sous-sc?nes rattachées à des sc?nes principales.

**Objets**  
Objets d'inventaire qui pourront être trouvés, requis ou combinés.

**Énigmes**  
Énigmes créées et reliées aux zones d'action.

**Cinématiques**  
Cinématiques narratives créées avec des slides textuelles.

**Ton**  
Ambiance d'écriture utilisée pour les textes, dialogues et descriptions : mystérieux, drôle, horrifique, poétique, réaliste.

**Durée visée**  
Temps de jeu visé. L'IA l'utilise pour doser le nombre d'étapes, d'indices et de détours narratifs.

**Instruction**  
Consigne libre pour guider l'IA. Plus elle est concrète, plus le résultat respecte ton intention.

Bon exemple :

> Crée une enquête dans un musée fermé, avec une fausse piste, trois objets utiles, une énigme de couleurs et une révélation finale autour d'un conservateur.

### Continuer un projet

**Source**  
Projet utilisé comme base. Le projet actuel vient de l'éditeur, le JSON importé permet de repartir d'une sauvegarde externe.

**Importer un JSON existant**  
Charge un projet JSON pour que l'IA puisse le continuer sans dépendre du projet actuellement ouvert.

**Résumé de l'histoire**  
Résumé de ce qui a déjà été joué. Il garde la suite cohérente avec les révélations et enjeux actuels.

**Chronologie des sc?nes**  
Ordre canonique de l'histoire. Numérote les sc?nes dans l'ordre de jeu prévu ; la suite partira de la dernière ligne.

**Sc?ne de départ détectée**  
Sc?ne exacte depuis laquelle l'histoire doit continuer. La nouvelle sc?ne doit être reliée à celle-ci.

**Ce que tu aimerais pour la suite**  
Direction souhaitée : nouveau lieu, type d'énigme, objet important, révélation, ton.

### Améliorer une scene

**Sc?ne à améliorer**  
L'IA garde la structure de la sc?ne et modifié seulement ambiance, dialogues et objets.

**Type d'enrichissement**  
Définit ce que l'étape doit renforcer : textes, descriptions visuelles, zones d'action ou tout ensemble.

**Contraintes visuelles de la scene**  
Contraintes données au générateur d'image. Liste les éléments visibles et leur placement approximatif.

**Style visuel global**  
Style partagé par les images de sc?nes pour éviter que chaque pièce parte dans une direction visuelle différente.

**Lisibilité des images**  
Ajuste automatiquement la luminosité après génération pour garder une image jouable sans trop délaver l'ambiance.

**Héritage visuel**  
Détails récurrents à conserver entre les pièces : portes, parquet, lumière, époque, matériaux.

## 13. Onglet Boutique

L'onglet **Boutique** sert à achétér ou retrouver des crédits IA.

Il affiché :

- ton identifiant d'achat ;
- les packs disponibles ;
- les boutons d'achat ;
- les consignes après paiement.

Copie l'identifiant d'achat si tu dois contacter le support. Les crédits sont associés à cet identifiant.

## 14. Onglet Preview

L'onglet **Preview** permet de jouer au projet comme un joueur.

Teste dans cet ordre :

1. La sc?ne ou cinématique de départ.
2. Chaque zone cliquable.
3. Les objets reçus.
4. L'inventaire.
5. Les combinaisons.
6. Les énigmes.
7. Les sc?nes débloquées.
8. Les cinématiques.
9. Les minuteurs.
10. Les règles de logique.
11. La fin du jeu.

Le jeu exporté propose aussi des actions de sauvegarde de partie :

- sauvegarder ;
- charger ;
- exporter une sauvegarde JSON ;
- importer une sauvegarde JSON ;
- ouvrir l'inventaire.

Conseil : après chaque grosse modification, testé immédiatement. Une erreur repérée tout de suite est beaucoup plus simple à corriger.

## 15. Onglet Bilan

L'onglet **Bilan** donné une note globale et des conseils.

### Structure

Mesure la richesse de base du projet :

- actes ;
- sc?nes ;
- objets ;
- énigmes ;
- cinématiques.

### Plan

Mesure la cohérence du parcours :

- sc?nes associées à des pièces ;
- départ ;
- liaisons vertes ;
- allers simples validés ;
- problèmes restants.

### Contenu

Mesure la jouabilité :

- point de départ valide ;
- sc?nes avec zones d'action utiles ;
- énigmes correctement renseignées.

Le bilan affiché aussi :

- le nombre d'éléments créés ;
- les sc?nes mappées ;
- les liaisons valides ;
- les allers simples validés ;
- les points à vérifier ;
- une estimation du temps de jeu.

Lis les conseils avant de publier. Ils indiquent souvent les oublis les plus gênants.

## 16. Publier dans la galerie publique

Depuis **Profil**, un projet peut être publié dans la galerie.

Avant de cliquer sur **Publier**, renseigne :

- **Catégorie** : horreur, enquête, aventure, science-fiction, fantastique, historique ou autre.
- **Mention d'age** : tout public ou +18 ans.
- **Miniature galerie** : image de présentation.

La miniature peut être recadrée avant publication. Choisis une image claire qui représente vraiment le jeu.

Après publication, le jeu peut être :

- trouvé dans la galerie ;
- joué par d'autres personnes ;
- noté ;
- commenté ;
- associé à ton profil auteur.

## 17. Galerie publique

La galerie permet de découvrir les jeux publiés.

Fonctions disponibles :

- recherche par jeu, auteur ou difficulté ;
- filtre par age ;
- classement par sections ;
- page détail d'un jeu ;
- page auteur ;
- mini blog auteur ;
- notation par étoiles ;
- avis court ;
- compteur de parties jouées ;
- bouton **Jouer maintenant**.

Un jeu marqué +18 affiché un avertissement.

## 18. Exporter le jeu

Dans la barre supérieure, clique sur **Exporter jeu**.

L'application génère une version prête à jouer. Cette version est destinée aux joueurs et ne nécessite pas d'ouvrir le builder.

Utilise l'export jeu quand :

- tu veux distribuer une version finale ;
- tu veux tester hors du builder ;
- tu veux archiver une version jouable ;
- tu veux envoyer le jeu à quelqu'un sans lui donner accès à l'édition.

## 19. Sauvegarder avec Export JSON

Clique sur **Exporter JSON** pour créer une sauvegarde éditable.

Fais un export JSON :

- avant une grosse modification ;
- avant d'utiliser l'IA sur un projet avancé ;
- avant de supprimer un projet ;
- avant publication ;
- quand une version fonctionne bien.

Le JSON est ton filet de sécurité.

## 20. Checklist précise avant publication

- Le projet a un titre clair.
- Le jeu commence par la bonne sc?ne ou la bonne cinématique.
- Chaque sc?ne importante possède un nom court et compréhensible.
- Les textes d'introduction posent l'ambiance sans donner les solutions.
- Les images de fond sont lisibles.
- Les zones cliquables sont assez grandes, y compris sur mobile.
- Chaque zone importante à une action claire.
- Les objets d'inventaire ont un nom compréhensible.
- Les objets visibles sont bien placés avec X, Y, largeur et hauteur.
- Les objets ramassables ne peuvent pas être récupérés à l'infini.
- Les énigmes ont une consigne claire.
- Les solutions d'énigmes ont été testées.
- Les messages d'échec aident sans révéler toute la réponse.
- Les déblocages d'énigmes pointent vers les bonnes sc?nes ou cinématiques.
- Les combinaisons utilisent deux objets distincts et un résultat utile.
- Les règles de logique ne contredisent pas les actions normales.
- Les cinématiques ont une action de fin correcte.
- Les animations 2D ont été prévisualisées, sauvegardées et exportées si elles doivent être réutilisées.
- Les transitions ne ralentissent pas trop le rythme.
- Les minuteurs sont justifiés et testés.
- Le plan contient un départ et une arrivée.
- Les liaisons du plan correspondent aux vraies zones d'action.
- Les allers simples sont volontairement validés.
- Le jeu a été joué du début à la fin dans **Preview**.
- Le **Bilan** ne signale plus de problème majeur.
- Une sauvegarde JSON a été exportée.
- La catégorie, la mention d'age et la miniature sont prêtes.

## 21. Dépannage utilisateur

### Je ne retrouvé pas une sc?ne dans une liste

Vérifie son nom, son acte et son éventuelle sc?ne parente. Certaines listes privilégient les sc?nes principales ou les sc?nes du même acte.

### Une zone cliquable ne fonctionne pas

Vérifie :

- sa taille ;
- sa position X/Y ;
- son action ;
- son objet requis ;
- son énigme liée ;
- sa sc?ne cible ;
- les règles de logique qui peuvent remplacer son action.

### Une énigme ne se lance pas

Vérifie qu'elle est bien liée à une zone d'action ou à une règle logique. Créer une énigme dans l'onglet **Énigmes** ne suffit pas à la rendre accessible.

### Une énigme réussie ne débloqué rien

Vérifie le champ **Débloqué**, puis la **Sc?ne à débloquér** ou la **Cinématique à lancer**.

### Un objet n'apparaît pas dans l'inventaire

Vérifie :

- que l'objet existe dans l'inventaire projet ;
- que la zone ou l'objet visible utilise le bon objet lié ;
- que le mode d'interaction inclut l'inventaire ;
- qu'une règle logique ne remplace pas l'action.

### Une transition du plan est signalée manquante

Le plan indique une liaison entre deux pièces, mais aucune zone d'action ne relie réellement les sc?nes. Ajoute une zone dans la sc?ne de départ vers la sc?ne cible, ou valide l'aller simple si c'est volontaire.

### Le joueur reste bloqué

Ajoute un indice dans :

- le dialogue d'une zone ;
- le message d'échec d'une énigme ;
- une image pop-up ;
- une cinématique courte ;
- un objet visible ;
- une règle de deuxième clic.


# Mode d'emploi détaillé - Escape Game Builder

Ce mode d'emploi explique comment créer, tester, partager et publier un escape game avec l'application en ligne. Il suit les écrans et les champs visibles dans le builder.

## 1. Utiliser l'écran Profil

L'écran **Profil** est le tableau de bord de tes projets. Il commence par des cartes d'action qui ouvrent chacune une page dédiée : didacticiels, création, gestion des projets, publication, médias, messagerie, profil public, badges et espace Pro quand ton compte y a accès. Le bouton **Retour au menu** ramène au tableau de bord.

Il sert aussi de point de contrôle avant d'entrer dans l'éditeur. Prends l'habitude de regarder le statut, les dates de modification et les indicateurs des cartes de projet avant de reprendre une version. Si un projet commence à devenir complexe, renomme-le clairement et duplique-le avant les gros changements.

### Cartes du profil

- **Didacticiels** : lance un parcours guidé pour découvrir le profil ou apprendre une zone du builder.
- **Créer un nouveau projet** : crée un jeu, choisit le mode de création, applique un template ou importe un JSON.
- **Modifier / gérer vos projets** : reprend, teste, renomme, duplique ou supprime les projets sauvegardés.
- **Organiser vos médias** : affiche les fichiers utilisés, leur poids, leur dossier et leurs usages.
- **Publier / partager vos jeux** : prépare les informations publiques, la miniature, le lien jouable et la présence dans la galerie.
- **Lire la messagerie** : regroupe les échanges support liés au compte.
- **Modifier votre profil** : règle l'identité publique et la sécurité du compte.
- **Voir vos badges** : affiche ta progression créateur et les paliers débloqués.
- **Créer des pages Pro** : pour les comptes Pro, crée et gère des vitrines, prologues ou épilogues liés à tes expériences.

Le menu est séparé en deux blocs côte à côte. À gauche se trouvent les actions de création, gestion de projets, publication et espace Pro. À droite se trouvent **Organiser vos médias**, **Lire la messagerie**, **Modifier votre profil** et **Voir vos badges**.

Quand une carte est ouverte, son contenu remplace le tableau de bord. Utilise **Retour au menu** pour revenir au choix principal, puis ouvre une autre page.

### Créer un nouveau projet

1. Ouvre la carte **Créer un nouveau projet**, puis écris le nom de ton escape game.
2. Choisis un mode de création selon la complexité voulue : débutant, intermédiaire, expert, narration ou Hero aventure.
3. Choisis un template :
   - **Projet vide** : démarre avec une base minimale.
   - **Narration choix multiples** : prépare des scènes reliées par des choix, conversations, réponses cachées et fins.
   - **Hero aventure** : ajoute une base de livre-jeu avec jet de dé virtuel, points de vie, mana et compétences.
   - **Manoir hanté** : prépare un univers de manoir.
   - **Enquête policière** : prépare une structure d'investigation.
   - **Laboratoire** : prépare une ambiance scientifique.
   - **Musée** : prépare une aventure autour d'artefacts.
4. Clique sur **Créer** pour ouvrir directement l'éditeur, ou sur **Créer avec aide guidée** si tu veux construire une première boucle avec le didacticiel.

Le template donne une première structure, mais tu peux tout modifier ensuite.

Le mode **Hero aventure** reprend la logique du mode à choix multiples, mais ajoute une fiche de héros dans la Preview : PV, mana, compétences et dé. Il est utile pour créer une expérience proche des livres dont vous êtes le héros, avec des choix narratifs et des tests de réussite.

### Gérer les projets existants

Ouvre la carte **Modifier / gérer vos projets**. Sur cette page, chaque projet peut être :

- **ouvert** pour reprendre l'édition ;
- **renommé** pour corriger son titre ;
- **dupliqué** pour créer une variante sans perdre l'original ;
- **supprimé** si tu n'en as plus besoin ;
- **testé** pour lancer rapidement sa version jouable ;
- **partagé** avec un lien ;
- **publié** dans la galerie publique.

La suppression est définitive. Exporte un JSON avant de supprimer si tu veux garder une sauvegarde.

Les compteurs et avertissements affichés sur les cartes ne remplacent pas un vrai test, mais ils donnent une première lecture rapide : scènes créées, énigmes incomplètes, connexions à vérifier ou informations publiques manquantes. Utilise-les comme une liste de choses à inspecter avant de publier.

### Importer un projet JSON

Dans la page **Créer un nouveau projet**, le bloc d'import sert à récupérer un projet précédemment exporté.

Utilise cette fonction pour :

- restaurer une sauvegarde ;
- transférer un jeu depuis un autre compte ou appareil ;
- reprendre un projet archivé ;
- tester une version reçue de quelqu'un.

Après import, ouvre le projet et vérifie-le dans **Preview**.

Après un import, vérifie surtout les images, sons et cinématiques. Si un ancien fichier ne contient pas toutes les ressources ou si une référence pointe vers un média absent, le jeu peut rester ouvrable mais afficher un fond vide, un objet sans miniature ou une cinématique incomplète.

### Badges et pages Pro

Ouvre **Voir vos badges** pour suivre ta progression créateur : projets créés, scènes, médias, publications, tests, followers et note de bilan. Les badges servent de repères rapides, pas d'obligation.

Si ton compte est Pro, la carte **Créer des pages Pro** ouvre les extensions d'expérience. Tu peux y créer ou gérer des pages légères reliées à un jeu, par exemple une vitrine, un prologue ou un épilogue, sans passer par tout le builder classique.

## 2. Barre supérieure du builder

Quand’un projet est ouvert, la barre supérieure affiche les actions globales.

- **Exporter JSON** : télécharge une sauvegarde complète du projet. C'est le fichier de travail.
- **Importer JSON** : charge un projet JSON depuis ton ordinateur.
- **Exporter jeu** : génère une version prête à jouer, séparée du builder.
- **Fiche auteur HTML** : génère une page imprimable du scénario pour debug et documentation.
- **Statut de sauvegarde** : indique si le projet est sauvegardé, en cours de synchronisation, local ou en erreur.
- **Déconnexion** : quitte le compte actif.

Différence importante :

- Le **JSON** sert à continuer l'édition dans le builder.
- L'**export jeu** sert à donner une version jouable à des joueurs.
- La **fiche auteur HTML** sert à relire la structure : branches, variables, fins, objets requis, chemins possibles et transitions.

## 3. Méthode recommandée pour créer un jeu

Pour éviter de se perdre, construis ton jeu dans cet ordre :

1. Crée les scènes principales.
2. Crée les objets d'inventaire importants dans **Objets**.
3. Ajoute les images, effets, sons et transitions dans **Média**.
4. Place les objets visibles et les zones cliquables dans **Scènes**.
5. Règle le comportement des objets visibles : pop-up, inventaire, dialogue ou retrait après usage.
6. Crée les énigmes.
7. Relie les énigmes aux zones d'action ou aux objets interactifs.
8. Ajoute les cinématiques.
9. Prépare les animations 2D dans **Animation** si ton jeu en utilise.
10. Crée les combinaisons d'objets.
11. Ajoute les règles avancées dans **Logique**.
12. Si tu fais une aventure à choix multiples, construis les conversations, réponses cachées, variables d'histoire et fins multiples.
13. Si tu fais une **Hero aventure**, définis les tests et combats importants : compétence utilisée, difficulté, coût de mana, dégâts, récompense et branche en cas d'échec.
14. Ouvre **Narration** pour contrôler les branches, variables, réponses cachées et fins.
15. Dessine le parcours dans **Plan** et vérifie la **Logique narrative**.
16. Teste du début à la fin dans **Preview**.
17. Corrige avec **Bilan**.
18. Publie ou exporte.

Cette méthode n'est pas obligatoire, mais elle évite les blocages les plus courants. Si tu commences par les images ou les énigmes, reviens ensuite au parcours global : chaque indice doit mener à une action, chaque action importante doit être testée, et chaque scène doit avoir une raison d'exister.

## 4. Onglet Scènes

L'onglet **Scènes** sert à construire les lieux du jeu et les interactions placées dessus.

Pense à cet onglet comme à l'atelier de jouabilité. Le décor vient de **Média**, mais c'est ici que tu décides ce que le joueur peut réellement faire : inspecter, ramasser, changer de lieu, résoudre une énigme ou déclencher une conséquence.

### Organisation du studio de scène

La nouvelle interface de **Scènes** est découpée en quatre zones :

- **Navigation** à gauche : actes, scènes principales et sous-scènes. Utilise-la pour passer vite d'un lieu à l'autre.
- **Général & structure** en haut : nom, acte, scène parente et texte d'introduction.
- **Plan de scène** au centre : canvas où tu vois le décor et où tu places objets visibles, zones d'action et effets locaux.
- **Panneau de sélection** à droite : réglages de l'élément sélectionné, par exemple position, taille, action, dialogue, objet lié ou effet.

Sur le canvas, le bouton de tiroir ouvre **Zones et objets**. Ce tiroir liste les calques de la scène : objets visibles, zones d'action et zones visuelles. Il sert à sélectionner un élément difficile à cliquer, masquer un calque, le verrouiller ou changer son ordre d'affichage.

Le menu **Ajouter** dans la barre du canvas sert à poser de nouveaux éléments :

- **Zone d'action** : une zone cliquable qui déclenche dialogue, objet, scène, cinématique, énigme, conversation, test ou combat selon le mode.
- **Objet visible** : une image ou un objet d'inventaire placé dans le décor.
- **Bloc** : texte, image, bouton, champ de saisie, code ou indice pour les modes avancés.
- **Animation** : animation 2D importée depuis l'onglet Animation, dans les modes qui l'autorisent.
- **Objet invisible** : zone technique utile quand tu veux une interaction sans visuel.
- **Zone visuelle** : effet local pour attirer l'attention ou renforcer l'ambiance.

### Champs principaux d'une scène

**Nom de la scène**  
Nom affiché dans la navigation de l'éditeur et dans les listes de choix. Garde-le court et explicite, surtout si plusieurs scènes se ressemblent.

Exemples :

- `Hall d'entrée`
- `Bureau fermé`
- `Gros plan du coffre`
- `Sous-sol - porte rouge`

**Acte**  
Regroupe la scène dans un chapitre. Si tu changes l'acte d'une scène, une scène parente incompatible peut être retirée.

Utilise les actes pour séparer :

- introduction ;
- exploration ;
- révélation ;
- final.

**Scène parente**  
Transforme la scène en sous-scène d'une autre. C'est utile pour les gros plans, tiroirs, portes, documents, coffres, placards ou variantes d'une même pièce.

Exemple :

- Scène principale : `Bureau`
- Sous-scènes : `Tiroir du bureau`, `Coffre mural`, `Tableau retourné`

**Texte d'introduction**  
Texte montré à l'entrée de la scène, avant que le joueur interagisse. Il pose l'ambiance ou l'objectif local.

Bon exemple :

> La pièce sent la poussière et l'encre sèche. Le bureau semble avoir été fouillé à la hâte.

Mauvais exemple :

> Trouve le code 4821 dans le tiroir.

Le deuxième donne trop directement la solution.

### Onglet Objets et objets d'inventaire

Un objet d'inventaire est ce que le joueur peut obtenir, garder, utiliser ou combiner.

Crée sa fiche dans l'onglet **Objets** avant de le placer ou de le donner au joueur. Cette fiche contient son nom, son image ou son emoji de secours, et ses éventuels effets Hero aventure. Ensuite, dans **Scènes**, tu peux relier cet objet à une zone d'action ou à un objet visible.

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

Un bon objet d'inventaire a souvent trois qualités : un nom compréhensible, une image reconnaissable et une fonction future. Si l'objet sert à ouvrir une porte, combine-le avec un dialogue ou une règle logique qui explique son usage. Si l'objet est seulement décoratif, préfère un objet visible sans ajout à l'inventaire.

### Objets visibles dans une scène

Un objet visible est placé directement sur l'image de la scène. Il peut être cliquable, inspecté, ramassé ou les deux.

Pour poser un objet visible, sélectionne la scène, ouvre **Ajouter**, puis choisis **Objet visible**. Si un objet d'inventaire est déjà sélectionné ou disponible, le builder peut reprendre son nom et son image pour le placer au centre du canvas. Déplace ensuite l'objet dans le décor, puis règle son comportement dans le panneau de sélection.

Champs importants :

- **Nom** : nom interne pour retrouver l'objet dans les calques et les listes.
- **X** : position horizontale du centre, en pourcentage de la largeur de l'image. `0` = bord gauche, `100` = bord droit.
- **Y** : position verticale du centre, en pourcentage de la hauteur de l'image. `0` = haut, `100` = bas.
- **Largeur** : largeur de la zone cliquable et de l'image visible, en pourcentage.
- **Hauteur** : hauteur de la zone cliquable et de l'image visible, en pourcentage.
- **Image fixe** : image affichée dans la scène si l'objet ne reprend pas directement l'image d'un objet d'inventaire.
- **Mode d'interaction** : définit si le clic montre un pop-up, ajoute un objet à l'inventaire, ou fait les deux.
- **Objet d'inventaire lié** : objet ajouté à l'inventaire si le mode inclut l'inventaire.
- **Dialogue** : texte affiché lors de l'interaction.
- **Retirer l'objet visible après interaction** : masque l'objet après un ramassage ou une utilisation réussie.

Modes d'interaction :

- **Pop-up uniquement** : le joueur inspecte un détail, comme une lettre ou une photo.
- **Inventaire uniquement** : le joueur ramasse directement un objet.
- **Pop-up + inventaire** : le joueur inspecte puis obtient l'objet.

Conseil : sur mobile, évite les objets trop petits. Une largeur ou hauteur trop faible rend l'interaction difficile.

Pour les objets importants, vérifie aussi leur profondeur d'affichage et leur visibilité sur le fond. Un objet très sombre sur un fond sombre peut être techniquement présent mais invisible pour le joueur. Utilise l'aperçu ou la Preview pour contrôler la lisibilité réelle.

Si tu ne retrouves pas un objet sur le canvas, ouvre le tiroir **Zones et objets**. Tu peux le sélectionner depuis la liste, le rendre visible, le déverrouiller ou le passer devant les autres éléments.

### Zones d'action

Une zone d'action est une zone cliquable invisible ou semi-visible. Elle déclenche une action après validation des prérequis éventuels.

Pour en créer une, ouvre **Ajouter** dans le canvas, puis choisis **Zone d'action**. La zone apparaît au centre de la scène : déplace-la sur une porte, un tiroir, un objet du décor ou un détail que le joueur doit pouvoir cliquer. Une fois sélectionnée, le panneau de droite affiche sa fiche complète.

Champs importants :

- **Nom** : nom interne qui décrit l'intention, par exemple `Porte verrouillée`.
- **X** et **Y** : position du centre de la zone en pourcentage.
- **Largeur** et **Hauteur** : taille dé la zone cliquable.
- **Action** : action principale déclenchée.
- **Dialogue** : réaction, indice ou confirmation affichée au joueur.
- **Scène cible** : destination si l'action est un changement de scène.
- **Cinématique cible** : cinématique lancée après interaction.
- **Énigme liée** : énigme à résoudre avant d'exécuter l'action de la zone.
- **Son de la zone** : son joué au moment où la zone est utilisée.
- **Image objet** : image associée à l'action, souvent utilisée pour montrer un objet trouvé ou un indice.

Actions typiques :

- afficher un dialogue ;
- donner un objet ;
- afficher un dialogue puis donner un objet ;
- changer de scène ;
- lancer une cinématique ;
- ouvrir une énigme ;
- ouvrir une conversation texte pour un mode narration à choix multiples.

Quand une zone est sélectionnée, une petite barre d'actions rapides peut apparaître au-dessus du canvas : dupliquer, masquer, verrouiller, changer l'ordre d'affichage, modifier rapidement l'action ou tester la zone. Utilise-la pour les corrections courtes, puis passe par le panneau de droite pour les réglages détaillés.

### Conversations et choix multiples

Quand l'action d'une zone est **Conversation texte**, le bouton **Modifier la conversation** ouvre une pop-up dédiée au dialogue. La question du PNJ reste en haut et les réponses du joueur s'organisent en colonnes selon leur nombre. La pop-up affiche aussi un **graphe interactif** avec questions, réponses, flèches, conditions, variables et fins : clique un nœud ou une flèche pour revenir au bloc à modifier.

Chaque réponse peut avoir sa propre conséquence :

- aller vers une autre question ;
- afficher un message ;
- afficher une image ou changer le portrait du PNJ ;
- jouer un son court ou lancer une ambiance sonore légère ;
- donner un objet ;
- lancer une énigme ;
- changer de scène ;
- lancer une cinématique ;
- effectuer des actions multiples ;
- afficher une fin d'aventure.

Les réponses peuvent aussi être cachées ou débloquées selon une condition : objet possédé, scène visitée, zone déjà utilisée, énigme résolue, choix précédent ou variable d'histoire.

Les variables d'histoire servent à mémoriser les choix du joueur. Exemple : `confiance_du_guide +1`, `alerte_tour = true`, `aide_villageois = false`. Une réponse plus tard peut apparaître seulement si cette variable à la bonne valeur.

Les fins multiples sont disponibles dans les conversations : bonne fin, mauvaise fin, fin secrète et fin neutre. Chaque fin a un titre et un résumé court affiché au joueur.

Exemples :

- `Porte cave` : demande une clé, puis ouvre la scène `Cave`.
- `Tableau étrange` : affiché un indice.
- `Coffre mural` : ouvre l'énigme `Code du coffre`.
- `Radio cassée` : joue un son puis donne une information.

### Onglet Narration

L'onglet **Narration** est le tableau de bord du mode à choix multiples. Il ne remplace pas la pop-up **Conversation texte** : il sert à vérifier ce que tu as construit.

Il affiche :

- le nombre de choix narratifs ;
- les réponses cachées ou débloquées ;
- les variables d'histoire détectées ;
- les fins possibles ;
- les problèmes à corriger.

Le bloc **Branches à corriger** signale les erreurs fréquentes : question suivante introuvable, scène cible absente, cinématique manquante, énigme non reliée, objet donné inexistant, condition incomplète, variable testée mais jamais modifiée ou fin sans titre.

Le bloc **Variables officielles** sert d'éditeur de variables d'histoire. Chaque variable possède :

- un **nom** exact, par exemple `confiance_du_guide` ;
- un **type** : nombre, booléen ou texte ;
- une **valeur de départ** utilisée au lancement du jeu ;
- une **description** interne pour rappeler son rôle ;
- un **nom dans le journal** pour traduire la variable en texte lisible côté joueur ;
- une option **Journal joueur** pour afficher ou masquer cette variable dans le journal.

Déclare les variables ici avant de les utiliser dans les réponses. Si une conversation utilise une variable absente du registre officiel, l'onglet **Narration** affiche une alerte **Variable utilisée mais non déclarée** avec un bouton pour la déclarer rapidement.

Vérifie aussi qu'une variable testée est bien modifiée avant d'être utilisée. Exemple : si une réponse demande `confiance_du_guide >= 1`, une autre réponse doit modifier `confiance_du_guide`.

L'onglet calcule aussi une **plage possible** pour les variables numériques. Si une fin ou une réponse demande une valeur impossible à atteindre, par exemple `confiance_du_guide >= 3` alors que les choix ne peuvent monter qu'à `2`, le diagnostic affiche **Fin probablement impossible** ou **Chemin probablement impossible**.

Le bloc **Recherche globale narrative** permet de retrouver partout où un élément est utilisé. Tu peux chercher :

- une variable ;
- un objet ;
- une fin ;
- une réponse ;
- une condition ;
- un morceau dé dialogue.

Chaque résultat indique la scène, la conversation et la suite concernée. Quand le résultat vient d'une réponse de conversation, les boutons **Ouvrir** et **Aller à la réponse** ramènent directement dans la pop-up d'édition.

Les **tags de branche** se règlent sur chaque réponse de conversation. Écris-les séparés par des virgules, par exemple `voie_foret, secret, danger`. Ils servent à filtrer le graphe interactif, à retrouver une famille dé choix dans la recherche globale narrative et à filtrer les réponses dans la fiche auteur HTML.

Les **notes auteur** se règlent sur chaque question et chaque réponse de conversation. Elles ne sont jamais visibles par le joueur. Utilise-les pour garder l'intention d'une branche, noter un indice à placer, marquer une conséquence à vérifier ou signaler une réponse à retravailler. Elles apparaissent dans la recherche globale narrative et dans la fiche auteur HTML.

Le bloc **Réponses et conséquences** liste chaque réponse du joueur avec son action : autre question, message, objet, actions multiples, scène, cinématique, énigme ou fin.

Le bloc **Fins** regroupe les fins multiples. Chaque fin devrait avoir un titre, un résumé et un chemin testable en **Preview**.

Les valeurs de départ sont prises en compte dans **Preview** et dans l'export joueur. Utilise cet onglet après une grosse modification de conversation et avant l'export. Il repère les oublis plus vite qu'un test manuel complet, même si la **Preview** reste indispensable pour valider le ressenti joueur.

Le bloc **Simulateur** permet de tester une branche sans jouer toute la partie. Tu peux :

- cocher les objets que le joueur possède ;
- marquer les énigmes déjà résolues ;
- régler les variables d'histoire ;
- voir les réponses qui deviennent visibles ;
- voir les fins accessibles avec cet état.

Le simulateur sert à vérifier les conditions principales. Il ne remplace pas une partie complète en **Preview**, mais il permet de repérer rapidement pourquoi une réponse cachée ou une fin secrète reste inaccessible.

Dans **Preview** et dans l'export, le **Journal joueur** récapitule les choix déjà faits, les indices ou objets obtenus, et les variables importantes avec leur nom lisible. Utilise-le pour aider le joueur à se souvenir de ses décisions sans lui montrer les noms techniques comme `confiance_du_guide`.

Chaque réponse de conversation peut aussi porter ses propres médias : image après réponse, son après réponse, portrait PNJ et ambiance. Utilise-les pour rendre un choix plus vivant sans créer une cinématique entière.

### Export résumé auteur

Le bouton **Fiche auteur HTML** génère une page autonome destinée au créateur, pas au joueur. Tu peux l'ouvrir dans un navigateur, l'imprimer ou l'enregistrer en PDF. Elle rassemble :

- la vue globale du projet ;
- toutes les branches de conversation ;
- les conditions simples et avancées combinées ;
- les effets multiples de chaque réponse : message, objet, variable, journal, suite, scène, cinématique, énigme ou fin ;
- les variables d'histoire déclarées ou détectées ;
- les fins multiples ;
- les objets cités par les conditions et les effets ;
- les chemins possibles détectés ;
- les transitions de scènes.

Utilise cette fiche après une grosse session d'écriture, avant l'export joueur ou quand’une branche devient difficile à relire dans l'éditeur.

### Deuxième action

Une zone peut avoir un comportement différent après une première utilisation.

Exemple :

- Premier clic sur `Tiroir` : donne `Clé rouillée`.
- Deuxième clic : affiché `Le tiroir est vide maintenant.`

Cette logique évite qu'un joueur récupère plusieurs fois le même objet.

Utilise la deuxième action pour donner un retour naturel après un événement : coffre déjà vidé, porte déjà ouverte, indice déjà lu, mécanisme déjà activé. Le joueur comprend mieux que son action a été prise en compte.

### Effets visuels de zone

Une scène peut contenir des zones d'effet visuel localisées.

Crée-les depuis **Scènes > Ajouter > Zone visuelle**, puis ajuste leur effet dans le panneau de sélection. L'onglet **Média** affiche aussi la liste des zones visuelles de la scène pour régler rapidement leur effet et leur intensité.

Champs importants :

- **Nom** : nom interne de la zone d'effet.
- **Effet** : effet affiché uniquement dans cette zone.
- **Intensité** : force de l'effet.
- **Calque** : détermine si l'effet passe derrière les objets, entre les objets et les zones, ou au-dessus de tout.
- **X**, **Y**, **Largeur**, **Hauteur** : position et taille dé la zone visuelle.

Utilise-les pour attirer l'attention sans casser l'immersion : lumière sur un coffre, fumée devant une porte, étincelles sur un mécanisme.

Les effets locaux doivent rester au service du gameplay. Un effet discret peut guider vers un indice ; un effet trop fort peut au contraire masquer la zone cliquable ou donner l'impression qu'un élément est interactif alors qu'il ne l'est pas.

## 5. Onglet Média

L'onglet **Média** centralise les images, sons, transitions, effets et minuteurs d'une scène.

Il complète l'onglet **Scènes** : tu y règles l'ambiance générale avant de placer les interactions. Une scène lisible avec un fond clair, un effet dosé et un son cohérent est beaucoup plus facile à tester qu'une scène spectaculaire mais confuse.

### Sélection de scène

**Scène**  
Choisis la scène dont tu veux régler les images, sons et effets.

Les badges de statut indiquent rapidement ce qui est prêt : fond, effet, musique, son secondaire, transition ou minuteur. Ils ne remplacent pas un test, mais ils permettent de repérer une scène encore vide.

### Aperçu de la scène

L'aperçu de **Média** montre le rendu du fond, de l'effet global, des zones visuelles, des objets visibles, des zones d'action et du minuteur. Utilise-le pour vérifier l'ambiance avant de revenir dans **Scènes**.

Cet aperçu est un contrôle visuel rapide. Pour vérifier les clics, l'inventaire, les dialogues et les changements de scène, passe ensuite dans **Preview**.

### Image et ambiance

**Image de fond**  
Image principale vue par le joueur dans cette scène. Elle doit être lisible et assez nette pour que les zones importantes soient compréhensibles.

Choisis une image avec des repères visuels forts : porte, bureau, coffre, fenêtre, tableau, tiroir. Ces repères deviennent ensuite des emplacements naturels pour les zones d'action et les objets visibles.

**Effet global**  
Filtre ou effet appliqué à toute la scène. Exemples : pluie, brouillard, neige, glitch, vision nocturne, film noir.

**Intensité globale**  
Force du filtre ou de l'effet global. Si l'effet gêne la lecture des indices, baisse l'intensité.

Si tu utilises à la fois un effet global et des zones visuelles locales, garde l'effet global plus subtil. Les zones locales doivent pouvoir ressortir sans créer une image illisible.

### Sons de scène

**Musique**  
Musique principale attachée à la scène. Elle peut accompagner l'exploration et boucler si la scène est destinée à durer.

**Son secondaire**  
Son d'ambiance ou détail sonore complémentaire : ventilation, gouttes d'eau, machine, horloge, radio lointaine. Il peut être utilisé pour donner de la vie au lieu sans remplacer la musique.

Conseil : évite de superposer trop de sons forts. Une ambiance réussie laisse de la place aux clics, aux sons de zones et aux cinématiques.

### Transitions

**Transition de sortie**  
Transition jouée quand le joueur quitte cette scène vers une autre scène.

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

**Scène d'arrivée test**  
Scène utilisée uniquement pour rejouer la transition dans l'aperçu Média. Cela ne change pas la vraie logique du jeu.

Utilise le test de transition pour vérifier le rythme. Une transition lente peut être agréable pour une révélation ou un changement d'acte, mais elle dévient pénible si le joueur traverse souvent cette porte.

### Minuteur de scène

Un minuteur ajoute une contrainte de temps à une scène.

Champs importants :

- **Durée** : temps disponible dans cette scène avant action automatique.
- **Fin du temps** : action déclenchée à zéro.
- **Scène cible** : scène ouverte à la fin du temps ou quand les vies tombent à zéro.
- **Cinématique cible** : cinématique lancée automatiquement.
- **Vies perdues** : nombre de vies retirées. Le joueur commence avec 3 vies dans l'aperçu.
- **Message de fin** : texte affiché si l'action de fin a besoin d'un message.

Actions possibles :

- rien ;
- aller à une scène ;
- relancer cette scène ;
- recommencer le jeu ;
- perdre des vies ;
- afficher un message ;
- lancer une cinématique.

Utilise un minuteur seulement si la prèssion sert le jeu. Un compte à rebours gratuit peut frustrer le joueur.

Un bon minuteur annonce clairement l'enjeu : danger qui approche, alarme, air qui manque, système qui se verrouille. Prévois toujours un message utile à la fin du temps pour expliquer ce qui vient de se passer.

## 6. Onglet Plan

L'onglet **Plan** sert à représenter le parcours du joueur et à vérifier les liaisons entre scènes.

Le plan n'est pas seulement décoratif. Il sert à comparer ton intention de parcours avec les vraies transitions créées dans les zones d'action. C'est souvent ici que tu repères une porte oubliée, un retour impossible ou une scène isolée.

### Pièces

Une pièce représente un lieu ou une étape du parcours. Elle peut être liée à une scène.

Actions utiles :

- **Ajouter une pièce** : crée une pièce manuellement.
- **Ajouter les scènes manquantes** : crée automatiquement des pièces pour les scènes non placées.
- **Relier** : crée une liaison entre deux pièces.
- **Supprimer** : supprime une pièce et ses liaisons.

Champs d'une pièce :

- **Nom** : nom affiché sur le plan.
- **Scène liée** : scène du builder associée à cette pièce.
- **Type** : pièce normale, départ ou arrivée.

Le plan accepte un seul départ principal. Si tu définis une nouvelle pièce comme départ, l'ancienne redevient normale.

Nomme les pièces comme le joueur les comprendrait : `Hall`, `Bureau`, `Cave`, `Laboratoire nord`. Si tu utilises des sous-scènes, place-les près de leur scène principale pour garder une lecture logique du parcours.

### Notes de parcours

Utilise **Notes de parcours** pour écrire :

- conditions d'accès ;
- ordre prévu ;
- passages optionnels ;
- pièges de connexion ;
- scènes à sens unique ;
- remarques de test.

### Vérification des liaisons

Le plan compare les liaisons dessinées avec les vraies transitions du jeu.

Une liaison peut être :

- **valide** : les zones d'action permettent bien de passer entre les scènes ;
- **partielle** : un seul sens existe ;
- **manquante** : le plan montre une liaison qui n'existe pas encore dans les zones ;
- **acceptée en aller simple** : tu confirmes volontairement qu'un retour n'est pas prévu.

Si le plan signale une liaison manquante, retourne dans **Scènes** et ajoute une zone d'action vers la bonne scène.

Une liaison partielle n'est pas toujours une erreur. Un passage peut être volontairement à sens unique : chute, porte qui se referme, ascenseur bloqué, scène de final. Dans ce cas, valide l'aller simple pour indiquer que ce choix est assumé.

### Logique narrative

Dans un projet aventure, le Plan affiche aussi un bloc **Logique narrative**. Il résume les choix créés dans les conversations de l'acte courant :

- nombre total de choix ;
- réponses cachées ou débloquées ;
- variables d'histoire modifiées ;
- fins disponibles.

Chaque ligne indique la réponse du joueur, la scène où elle se trouve, sa conséquence, sa condition éventuelle et la variable modifiée. Les fins sont colorées par type : bonne, mauvaise, secrète ou neutre.

Cette vue sert à vérifier que les chemins narratifs existent vraiment. Si une fin secrète n'apparaît jamais en Preview, regarde ici si sa condition est trop stricte ou si l'objet, la variable ou le choix précédent n'est jamais obtenu.

## 7. Onglet Cinématiques

Les cinématiques servent d'introduction, transition, révélation, récompense ou conclusion.

Utilise-les quand’un événement mérite un temps narratif séparé. Une cinématique courte peut renforcer une révélation, mais si elle explique une action simple, un dialogue de zone suffit souvent.

### Démarrage du jeu

**Le jeu commence par**  
Détermine le premier écran du joueur : une scène jouable ou une cinématique d'introduction.

**Scène de départ**  
Scène ouverte au début si le démarrage est réglé sur une scène.

**Cinématique de départ**  
Cinématique jouée au début si le démarrage est réglé sur une cinématique.

### Créer une cinématique

**+ Cinématique**  
Crée une nouvelle cinématique. Elle peut ensuite être appelée depuis une zone d'action, une énigme ou le démarrage du jeu.

Donne un nom fonctionnel à chaque cinématique : `Intro laboratoire`, `Révélation coffre`, `Final fuite`. Les noms internes clairs évitent de choisir la mauvaise séquence dans les zones ou les énigmes.

Champs importants :

- **Nom de la cinématique** : nom interne visible dans les listes de choix.
- **Type de cinématique** : diaporama de slides ou vidéo importée.

### Type vidéo

**Fichier vidéo**  
Fichier joué par la cinématique. Le format MP4 est le plus fiable.

**Lecture auto**  
Lance automatiquement la vidéo au démarrage de la cinématique. Certains navigateurs bloquent l'audio tant que le joueur n'a pas interagi.

**Afficher les contrôles**  
Affiche lecture, pause, barre de progression et volume.

### Type slides

Chaque slide peut contenir :

- **Image** : pose une ambiance, montre un indice ou illustre une transition.
- **Narration** : texte affiché avec le slide.
- **Son** : audio ou voix associée au slide.

La narration doit être courte. Une cinématique doit rythmer le jeu, pas remplacer toutes les interactions.

Chaque slide doit idéalement porter une seule idée : une image, une phrase, un son. Si tu as besoin de beaucoup expliquer, découpe en plusieurs slides ou transforme une partie de l'information en indice jouable.

### Action de fin

**Action de fin**  
Action déclenchée quand la cinématique se termine.

Possibilités :

- rester sur place ;
- aller à un acte ;
- ouvrir une scène ;
- donner un objet.

Champs liés :

- **Acte de destination** : utile pour passer à un nouveau chapitre.
- **Scène de destination** : scène ouverte après la cinématique.
- **Objet donné** : objet ajouté à l'inventaire à la fin.

Teste toujours l'action de fin. Une cinématique sans destination ou avec un objet de récompense mal choisi peut laisser le joueur dans une impasse après une séquence pourtant réussie.

## 8. Onglet Animation

L'onglet **Animation** sert à préparer une scène animée en 2D : tu importes des images, tu les places sur un décor, tu leur appliques une animation, puis tu construis une petite séquence avec une timeline. Il est utile pour créer un plan vivant, une apparition de personnage, une révélation visuelle, une courte transition ou une image animée à exporter.

Il fonctionne comme un mini-studio séparé du builder principal. Tu peux y préparer une composition, la sauvegarder comme brouillon, l'exporter, puis décider ensuite si elle sert d'image, d'inspiration ou de ressource pour une cinématique.

### Barre de menus

La barre du haut regroupe les actions principales :

- **Fichier** : importer une image, importer un JSON, sauvegarder le brouillon, exporter le JSON, enregistrer l'image selectionnée ou repartir sur un nouveau brouillon.
- **Éditer** : annuler, rétablir, dupliquer un calque, changer son ordre, verrouiller ou supprimer le calque selectionné.
- **Affichage** : zoomer, dézoomer, réinitialiser la vue ou lancer la lecture.
- **Image** : détourer, gommer, restaurer, rogner ou revenir à l'image originale.
- **Animation** : appliquer un preset d'animation au calque selectionné.

Le bouton **Nouveau projet** remet l'animation à zéro. Un message d'avertissement confirme que le projet en cours sera supprimé avant d'effacer le brouillon.

### Sauvegarde et brouillon

**Sauvegarder** enregistré le brouillon de l'animation. Le brouillon est restauré automatiquement quand tu reviens dans l'onglet, ce qui évite de perdre une composition en cours.

Utilise **Exporter JSON** pour garder une version portable dé l'animation ou la transférer sur un autre appareil. Utilise **Importer JSON** pour reprendre une animation exportée.

Conseil : sauvegarde avant une grosse retouche d'image ou avant de remplacer plusieurs calques.

Le brouillon est surtout utile pendant les essais. L'export JSON, lui, sert de vraie sauvegarde portable : garde-le quand’une version d'animation est importante ou difficile à refaire.

### Storyboard

Le panneau **Storyboard** contient les étapes de la séquence.

**Ajouter une étape** crée un nouveau moment sur la timeline. Chaque étape indique :

- le temps de départ ;
- la durée ;
- l'action image ;
- le texte ou la narration associée.

Une étape peut afficher une image, remplacer une image déjà visible ou piloter une partie de la scène. Garde les étapes courtes pour que la lecture reste lisible.

Exemple :

1. `0.0s` : afficher le décor.
2. `3.0s` : faire apparaître un personnage.
3. `7.0s` : révéler un indice.
4. `11.0s` : remplacer l'image par une version plus dramatique.

### Canvas

Le **Canvas** est la zone de composition. Tu peux y déplacer les calques visuellement, ajuster leur taille et vérifier leur rendu sur le décor.

Commandes utiles :

- **Lecture** : joue la séquence.
- **Annuler / rétablir** : revient sur les dernières modifications.
- **Zoom** : agrandit ou réduit la vue de travail.
- **Réinitialiser la vue** : replace le canvas dans une vue confortable.

Clique sur un calque pour le selectionner, puis utilise l'inspecteur à droite pour le régler précisément.

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

Si un élément ne répond pas comme prévu, vérifie d'abord qu'il n'est pas verrouillé et qu'un autre calque ne passe pas devant lui. Les problèmes d'ordre de calques ressemblent souvent à des problèmes de selection.

### Verrouiller un calque

Le verrouillage empêche de déplacer ou modifier accidentellement une image. Utilise-le quand’un élément est bien placé, surtout pour les grands fonds ou les décors.

Un calque verrouillé reste visible, mais il ne se retouche pas tant qu'il n'est pas déverrouillé.

### Presets d'animation

Les presets donnent rapidement du mouvement à un calque :

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

Choisis un preset selon l'intention narrative. Un indice peut clignoter doucement, mais un personnage principal sera souvent plus naturel avec **Respiration** ou **Regard**.

### Retouche d'image

Le menu **Image** permet de corriger un calque sans quitter l'éditeur.

Fonctions disponibles :

- **Détourage remove.bg** : retire le fond avec le service remove.bg si la configuration est disponible.
- **Détourage IA local** : tente un détourage directement dans le navigateur.
- **Gommer** : efface une partie de l'image.
- **Restaurer** : récupère une zone depuis l'image originale.
- **Rogner** : recadre l'image.
- **Revenir à l'original** : annule les retouches du calque selectionné.

Conseil : duplique un calque avant une retouche risquée. Tu gardes ainsi une version de secours.

Les outils de retouche sont pratiques pour corriger vite, mais ils peuvent changer fortement l'apparence d'une image. Travaille par petites étapes : détourer, vérifier, gommer, vérifier, puis seulement rogner si nécessaire.

### Inspecteur

L'**Inspecteur** affiche les réglages du calque selectionné.

Utilise-le pour :

- verrouiller ou déverrouiller l'image ;
- modifier l'ordre du calque ;
- corriger précisément X, Y, taille et opacité ;
- régler durée, délai et bouclé ;
- activer les outils de gommage, restauration ou rognage.

Si rien n'est selectionné, clique d'abord sur un calque dans le canvas ou dans la scène.

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
- Exporte un JSON quand’une version fonctionne bien.

## 9. Onglet Combinaisons

Les combinaisons créent des recettes d'inventaire. Le joueur combine deux objets pour obtenir un résultat.

Elles sont utiles quand tu veux récompenser l'observation et la déduction. Une bonne combinaison doit sembler logique après coup : pile + lampe, moitié de carte + autre moitié, clé cassée + manche, indice chiffré + carnet.

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
- Message : `La lampe fonctionne. Tu peux maintenant explorer les zones sombres.`

Conseil : évite les recettes ambiguës. Si deux objets peuvent logiquement créer plusieurs résultats, clarifie avec les noms ou les messages.

Teste les combinaisons dans **Preview** avec les objets réellement obtenus. Si le joueur ne peut jamais récupérer l'un des deux objets, la recette existe dans le builder mais reste impossible à utiliser.

## 10. Onglet Énigmes

L'onglet **Énigmes** crée les défis que le joueur doit résoudre.

Créer une énigme ne suffit pas à la rendre jouable : elle doit être reliée à une zone d'action, à une règle logique ou à un autre déclencheur. Pense donc toujours en deux temps : configurer le défi, puis décider où le joueur le rencontre.

### Liste des énigmes

**Énigme à configurer**  
Liste des énigmes du projet. Sélectionne une énigme pour modifier sa question, sa solution et ce qu'elle débloqué.

**+ Énigme**  
Crée une nouvelle énigme. Elle dévra ensuite être liée à une zone d'action dans l'éditeur de scène pour être jouable.

### Champs communs

**Nom**  
Nom interne de l'énigme. Il sert à la retrouver dans les listes et dans les choix de zones d'action.

**Type**  
Détermine l'interface joueur : code à saisir, combinaison de couleurs, puzzle d'image ou mécanique diverse.

Choisis le type selon ce que le joueur doit comprendre. Un code convient à une réponse courte, les couleurs conviennent à une suite visuelle, le puzzle d'image convient à une observation, et le type Divers convient aux questions, associations ou choix plus libres.

**Question / consigne**  
Consigne affichée au joueur. Elle doit expliquer quoi faire sans forcément donner la solution.

**Message de réussite**  
Texte affiché quand le joueur réussit. Idéal pour confirmer la découverte ou donner un nouvel indice.

**Message d'échec**  
Texte affiché quand la réponse est incorrecte. Il peut guider sans révéler directement la solution.

**Débloqué**  
Action déclenchée après réussite :

- rien de spécial ;
- ouvrir une scène ;
- lancer une cinématique.

**Scène à débloquer**  
Scène rendue accessible après réussite si le déblocage choisi est une scène.

**Cinématique à lancer**  
Cinématique lancée après réussite si le déblocage choisi est une cinématique.

### Type Code lettres / chiffres

Le joueur saisit une réponse exacte.

**Solution**  
Réponse exacte attendue. Tu peux utiliser chiffres, lettres ou mélange court.

**Forme côté joueur**  
Apparence visuelle du code. La solution reste la même, seule l'interface change.

La forme aide le joueur à comprendre le contexte. Un digicode suggère une porte moderne, des molettes suggèrent un coffre, des cases séparées suggèrent un mot ou une séquence, et une bande papier suggère un indice écrit.

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
- couleurs vers chiffres ou lettres ;
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
Plus il y en a, plus le joueur manipule dé pièces.

Conseil : pour un premier jeu, commence avec `3 x 3`. Augmente seulement si l'image est très lisible.

Une image trop uniforme rend le puzzle frustrant. Préfère une image avec des détails distincts dans plusieurs zones : texte, symbole, visage, serrure, couleur forte ou forme reconnaissable.

### Type Divers

Le type **Divers** regroupe plusieurs mécaniques.

**Mode Divers**  
Détermine si l'énigme attend’une réponse libre ou propose plusieurs choix.

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
- objet à selectionner ;
- nombre exact.

Champs selon le mode :

- **Solution attendue** : réponse correcte principale.
- **Choix proposés** : liste utilisée comme choix, ordre attendu ou réponses selectionnables.
- **Minimum accepté** et **Maximum accepté** : plage numérique acceptée.
- **Objet attendu** : objet que le joueur doit selectionner.
- **Paires attendues** : associations correctes.
- **Bonnes réponses** : réponses valides pour les modes à choix multiples.

### Fond de pop-up

Une énigme peut avoir une image de fond dédiée.

**Fond de pop-up**  
Image affichée derrière le contenu de la pop-up joueur.

**Zoom**  
Niveau dé recadrage de l'image.

**Horizontal** et **Vertical**  
Position de l'image derrière la zone d'écriture.

**Voile dé lisibilité**  
Intensité du voile sombre placé sur l'image pour garder le texte lisible.

Utilise un fond de pop-up pour donner du style à une énigme importante, mais vérifie que la consigne reste facile à lire.

Après avoir ajouté un fond, teste l'énigme dans l'aperçu joueur. Ajuste le zoom, la position et le voile dé lisibilité jusqu'à ce que la question, les champs et les boutons restent visibles sur petit écran.

## 11. Onglet Logique

L'onglet **Logique** permet de remplacer ou compléter le comportement normal des zones selon l'état de la partie.

Utilise-le quand’une simple zone d'action ne suffit plus. C'est l'endroit idéal pour créer des portes qui réagissent aux objets possédés, des indices qui apparaissent après une énigme, des objets qui disparaissent après ramassage ou des comportements différents au déuxième clic.

### Sélectionner une scène

**Scène à configurer**  
Choisis la scène dont tu veux régler les conditions. Les règles affichées ne concernent que cette scène.

### Zones d'action

**Zones d'action**  
Zones cliquables de la scène selectionnée. Une règle conditionnelle peut remplacer leur action normale selon l'état de la partie.

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

Commence par une seule condition simple, puis ajoute de la complexité seulement si le test joueur le justifie. Plusieurs règles sur une même zone peuvent vite devenir difficiles à relire.

Dans les conversations d'aventure, les conditions se règlent directement sur chaque réponse. C'est là que tu crées une réponse cachée du type `Je connais le mot de passe`, visible seulement si le joueur possède un indice, a visité une scène, a résolu une énigme, a fait un choix précédent ou possède une variable d'histoire précise.

### Actions possibles

Une règle peut déclencher :

- l'action normale dé la zone ;
- un dialogue ;
- un dialogue + objet ;
- un changement de scène ;
- une cinématique.

L'action déclenchée remplace ou complète le comportement normal selon la configuration. Si le résultat attendu ne se produit pas, vérifie l'ordre mental suivant : condition vraie, objet requis présent, énigme résolue, puis action cible correctement renseignée.

Dans une conversation, une réponse peut aussi déclencher plusieurs conséquences à la fois : afficher un message, donner un objet, modifier une variable, puis aller vers une autre question ou une fin.

### Options utiles

**Retirer l'objet requis**  
Retire l'objet testé de l'inventaire après activation. Utile pour une clé utilisée une seule fois, un ticket donné ou une pile consommée.

**Désactiver après usage**  
Désactive cette règle après sa première activation. Utile pour ouvrir une porte une fois, puis laisser la zone suivre sa logique normale.

**Objets visibles**  
Objets placés directement dans l'image de la scène. Leur comportement peut être réglé ici sans passer par les zones d'action.

**Cacher l'objet visible**  
Cache l'objet dans la scène après son utilisation. Pratique pour un objet ramassé ou un élément qui disparaît.

Exemple dé règle :

- Condition : le joueur possède `Clé rouillée`.
- Action : changer de scène vers `Cave`.
- Option : retirer l'objet requis.
- Résultat : la clé ouvre la porte puis disparaît de l'inventaire.

Autre exemple utile :

- Condition : l'énigme `Code du coffre` est réussie.
- Action : dialogue + objet.
- Objet donné : `Document secret`.
- Option : désactiver après usage.
- Résultat : le joueur récupère le document une seule fois, puis la zone peut afficher un message plus simple.

## 12. Onglet IA

L'onglet **IA** aide à générer, continuer ou enrichir un projet.

Considère toujours le résultat IA comme un brouillon à relire. L'IA peut créer rapidement une structure, mais c'est toi qui vérifies la cohérence du parcours, la lisibilité des images, les solutions d'énigmes et la logique des objets.

### Champs de génération

**Mode**  
Choisit le type d'aide IA : créer un récit complet, avancer acte par acte, continuer un projet existant ou améliorer une scène précise.

Choisis **Générer** pour démarrer vite, **Progressif** pour construire acte par acte, **Continuer** pour prolonger une version existante, et **Améliorer** quand tu veux enrichir une scène sans remplacer tout le projet.

**Thème**  
Thème principal de l'histoire : manoir, station spatiale, enquête policière, laboratoire, musée, etc.

**Difficulté**  
Influence la complexité des énigmes, le nombre de dépendances et les conditions de déblocage.

**Actes**  
Grandes parties de l'histoire. Un acte contient plusieurs scènes.

**Scènes**  
Nombre de scènes principales à générer.

**Sous-scènes**  
Nombre de sous-scènes rattachées à des scènes principales.

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

Avant de lancer, relis le coût estimé et ce que l'IA prévoit de modifier. Si ton projet est déjà avancé, fais un export JSON avant d'appliquer un gros brouillon.

### Continuer un projet

**Source**  
Projet utilisé comme base. Le projet actuel vient de l'éditeur, le JSON importé permet de repartir d'une sauvegarde externe.

**Importer un JSON existant**  
Charge un projet JSON pour que l'IA puisse le continuer sans dépendre du projet actuellement ouvert.

**Résumé de l'histoire**  
Résumé de ce qui a déjà été joué. Il garde la suite cohérente avec les révélations et enjeux actuels.

**Chronologie des scènes**  
Ordre canonique de l'histoire. Numérote les scènes dans l'ordre de jeu prévu ; la suite partira de la dernière ligne.

**Scène de départ détectée**  
Scène exacte depuis laquelle l'histoire doit continuer. La nouvelle scène doit être reliée à celle-ci.

**Ce que tu aimerais pour la suite**  
Direction souhaitée : nouveau lieu, type d'énigme, objet important, révélation, ton.

### Améliorer une scène

**Scène à améliorer**  
L'IA garde la structure de la scène et modifie seulement ambiance, dialogues et objets.

**Type d'enrichissement**  
Définit ce que l'étape doit renforcer : textes, descriptions visuelles, zones d'action ou tout ensemble.

**Contraintes visuelles de la scène**  
Contraintes données au générateur d'image. Liste les éléments visibles et leur placement approximatif.

**Style visuel global**  
Style partagé par les images de scènes pour éviter que chaque pièce parte dans une direction visuelle différente.

**Lisibilité des images**  
Ajuste automatiquement la luminosité après génération pour garder une image jouable sans trop délaver l'ambiance.

**Héritage visuel**  
Détails récurrents à conserver entre les pièces : portes, parquet, lumière, époque, matériaux.

L'héritage visuel est important pour éviter l'effet "images sans lien". Décris les éléments qui doivent revenir : architecture, palette, époque, type d'éclairage, style dés meubles, météo ou signes distinctifs du lieu.

## 13. Onglet Boutique

L'onglet **Boutique** sert à acheter ou retrouver des crédits IA.

Il affiche :

- ton identifiant d'achat ;
- les packs disponibles ;
- les boutons d'achat ;
- les consignes après paiement.

Copie l'identifiant d'achat si tu dois contacter le support. Les crédits sont associés à cet identifiant.

## 14. Onglet Preview

L'onglet **Preview** permet de jouer au projet comme un joueur.

La Preview est le test le plus important du builder. Elle révèle les problèmes que les formulaires ne montrent pas toujours : zone trop petite, objet invisible, message peu clair, énigme mal reliée, transition trop lente ou joueur bloqué.

Teste dans cet ordre :

1. La scène ou cinématique de départ.
2. Chaque zone cliquable.
3. Les objets reçus.
4. L'inventaire.
5. Les combinaisons.
6. Les énigmes.
7. Les scènes débloquées.
8. Les cinématiques.
9. Les minuteurs.
10. Les règles de logique.
11. Les conversations à choix multiples.
12. Les réponses cachées et variables d'histoire.
13. Le journal joueur : choix déjà faits, indices obtenus et variables importantes traduites en texte lisible.
14. Les différentes fins du jeu.

### Configurer une Hero aventure

L'onglet **Héros** centralise la fiche de livre-jeu :

- nom du héros ;
- dé principal (`d6`, `d20`, etc.) ;
- PV de départ et PV maximum ;
- mana de départ et mana maximum ;
- compétences, bonus et coûts en mana ;
- valeurs de réussite critique et d'échec critique.

Ces réglages alimentent la fiche affichée dans la Preview. Commence simple : trois compétences, un dé principal, puis ajoute seulement les ressources utiles à ton histoire.

### Tests, combats et objets Hero aventure

Dans **Scènes**, une zone d'action peut utiliser **Test de compétence**. Le joueur clique la zone, la Preview lance le dé, ajoute le bonus de la compétence choisie, compare le total à la difficulté, puis applique la réussite ou l'échec : message, scène cible, perte de PV ou objet gagné.

Une zone peut aussi utiliser **Combat simple**. Elle configure un ennemi, ses PV, la compétence d'attaque, la difficulté pour toucher, les dégâts du héros, la riposte ennemie, une récompense et une scène de victoire ou de défaite. Les PV de l'ennemi sont mémorisés pendant la partie : plusieurs clics peuvent être nécessaires pour gagner.

Les objets d'inventaire peuvent devenir des **objets héros** :

- **Potion de soin** : rend des PV quand le joueur clique l'objet dans l'inventaire.
- **Potion de mana** : rend de la mana.
- **Équipement avec bonus** : ajoute un bonus à une compétence une seule fois par partie.

Dans **Logique**, tu peux aussi déclencher une règle selon l'état du héros : PV inférieurs à un seuil, mana suffisante, dernier jet réussi ou dernière compétence utilisée. C'est utile pour ouvrir une issue seulement si le joueur est encore en forme, a assez de mana ou vient de réussir une action précise.

### Tester une Hero aventure

Dans un projet **Hero aventure**, la Preview affiche une fiche de héros en plus de l'inventaire et des dialogues.

Elle sert à tester :

- les **PV** : points de vie du héros, modifiables pendant le test ;
- la **mana** : ressource consommée par certaines compétences ;
- les **compétences** : Force, Ruse, Magie ou toute compétence configurée dans le projet ;
- le **jet de dé virtuel** : un lancer libre ou un lancer avec bonus de compétence ;
- le **dernier résultat** : total du dé + bonus, utile pour décider si un choix réussit.

Un jet libre depuis le panneau Hero sert à tester le dé ou à soutenir une narration manuelle. Pour une conséquence automatique, utilise plutôt **Test de compétence** ou **Combat simple** dans une zone, ou une réponse de conversation quand le test doit se produire dans un dialogue.

Le jeu exporté propose aussi des actions de sauvegarde de partie :

- sauvegarder ;
- charger ;
- exporter une sauvegarde JSON ;
- importer une sauvegarde JSON ;
- ouvrir l'inventaire.

Utilise aussi l'aide visuelle si elle est disponible pour voir les zones interactives pendant les tests. Ensuite, désactive-la et rejoue une fois normalement pour vérifier que les indices suffisent sans assistance.

Pour une Hero aventure, teste dans la Preview puis dans l'export joueur :

- un test réussi et un test échoué ;
- un combat gagné et, si possible, une défaite ;
- une potion de soin, une potion de mana et un équipement ;
- une règle logique liée aux PV, à la mana ou au dernier jet ;
- une sauvegarde puis un chargement après avoir modifié PV, mana, inventaire ou combat.

Conseil : après chaque grosse modification, teste immédiatement. Une erreur repérée tout de suite est beaucoup plus simple à corriger.

## 15. Onglet Bilan

L'onglet **Bilan** donne une note globale et des conseils.

Le Bilan n'est pas une note artistique. Il mesure surtout la structure, la jouabilité et les oublis probables. Un score moyen peut être acceptable pour un prototype ; avant publication, il doit surtout t'aider à corriger les points bloquants.

### Structure

Mesure la richesse de base du projet :

- actes ;
- scènes ;
- objets ;
- énigmes ;
- cinématiques.

### Plan

Mesure la cohérence du parcours :

- scènes associées à des pièces ;
- départ ;
- liaisons vertes ;
- allers simples validés ;
- problèmes restants.

### Contenu

Mesure la jouabilité :

- point de départ valide ;
- scènes avec zones d'action utiles ;
- énigmes correctement renseignées.

Le bilan affiche aussi :

- le nombre d'éléments créés ;
- les scènes mappées ;
- les liaisons valides ;
- les allers simples validés ;
- les points à vérifier ;
- une estimation du temps de jeu.

Lis les conseils avant de publier. Ils indiquent souvent les oublis les plus gênants.

Après chaque correction importante, retourne dans **Preview**. Le Bilan indique quoi vérifier, mais seule une partie complète confirme que le jeu se déroule correctement.

## 16. Publier dans la galerie publique

Depuis **Profil**, un projet peut être publié dans la galerie.

Avant de cliquer sur **Publier**, renseigne :

- **Catégorie** : horreur, enquête, aventure, science-fiction, fantastique, historique ou autre.
- **Mention d'âge** : tout public ou +18 ans.
- **Miniature galerie** : image de présentation.

La miniature peut être recadrée avant publication. Choisis une image claire qui représente vraiment le jeu.

Avant de publier, vérifie que le titre, la miniature, la catégorie et la mention d'âge correspondent à l'expérience réelle. Une bonne fiche évite les mauvaises attentes : un jeu d'horreur, une enquête calme et une aventure familiale ne se présentent pas de la même façon.

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
- filtre par âge ;
- classement par sections ;
- page détail d'un jeu ;
- page auteur ;
- mini blog auteur ;
- notation par étoiles ;
- avis court ;
- compteur de parties jouées ;
- bouton **Jouer maintenant**.

Un jeu marqué +18 affiche un avertissement.

## 18. Exporter le jeu

Dans la barre supérieure, clique sur **Exporter jeu**.

L'application génère une version prête à jouer. Cette version est destinée aux joueurs et ne nécessite pas d'ouvrir le builder.

L'export doit être considéré comme une version finale ou de test externe. Si tu modifies ensuite le projet dans le builder, refais un export pour obtenir une version jouable à jour.

Pour une **Hero aventure**, l'export reprend la fiche héros, les PV, la mana, les tests automatiques, les combats simples, les objets héros et les conditions de logique héros. Refais toujours un export après avoir changé une règle, un coût de mana, un objet héros ou une scène de victoire/défaite.

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
- quand’une version fonctionne bien.

Le JSON est ton filet de sécurité.

Nomme tes sauvegardes avec une date ou une étape claire, par exemple `manoir-v2-avant-ia.json` ou `laboratoire-final-test.json`. Tu retrouveras plus facilement la bonne version si tu dois revenir en arrière.

## 20. Checklist précise avant publication

- Le projet a un titre clair.
- Le jeu commence par la bonne scène ou la bonne cinématique.
- Chaque scène importante possède un nom court et compréhensible.
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
- Les déblocages d'énigmes pointent vers les bonnes scènes ou cinématiques.
- Les combinaisons utilisent deux objets distincts et un résultat utile.
- Les règles de logique ne contredisent pas les actions normales.
- Les conversations à choix multiples ont été testées dans toutes les branches importantes.
- Les réponses cachées ont une condition réellement atteignable.
- Les variables d'histoire sont modifiées avant d'être testées.
- Les variables utiles au joueur ont un nom de journal clair, et les variables techniques sont masquées du journal.
- Chaque fin multiple a un titre, un résumé et un chemin possible.
- L'onglet **Narration** ne signale plus de branche cassée ou de variable incohérente.
- En mode Hero aventure, les jets de dé, PV, mana, compétences et coûts de mana ont été testés en Preview.
- Les dialogues indiquent clairement quelle compétence lancer, quelle difficulté viser et ce qui se passe en cas d'échec.
- Les cinématiques ont une action de fin correcte.
- Les animations 2D ont été prévisualisées, sauvegardées et exportées si elles doivent être réutilisées.
- Les transitions ne ralentissent pas trop le rythme.
- Les minuteurs sont justifiés et testés.
- Le plan contient un départ et une arrivée.
- Les liaisons du plan correspondent aux vraies zones d'action.
- La Logique narrative du Plan liste bien les choix, conditions, variables et fins attendus.
- Les allers simples sont volontairement validés.
- Le jeu a été joué du début à la fin dans **Preview**.
- Le **Bilan** ne signale plus de problème majeur.
- Une sauvegarde JSON a été exportée.
- La catégorie, la mention d'âge et la miniature sont prêtes.

## 21. Dépannage utilisateur

### Je ne retrouve pas une scène dans une liste

Vérifie son nom, son acte et son éventuelle scène parente. Certaines listes privilégient les scènes principales ou les scènes du même acte.

### Une zone cliquable ne fonctionne pas

Vérifie :

- sa taille ;
- sa position X/Y ;
- son action ;
- son objet requis ;
- son énigme liée ;
- sa scène cible ;
- les règles de logique qui peuvent remplacer son action.

Teste aussi si une autre zone ou un objet visible passe devant. Deux éléments superposés peuvent donner l'impression qu'une zone ne répond pas alors que le clic arrive sur un autre élément.

### Une énigme ne se lance pas

Vérifie qu'elle est bien liée à une zone d'action ou à une règle logique. Créer une énigme dans l'onglet **Énigmes** ne suffit pas à la rendre accessible.

### Une énigme réussie ne débloqué rien

Vérifie le champ **Débloqué**, puis la **Scène à débloquer** ou la **Cinématique à lancer**.

### Un objet n'apparaît pas dans l'inventaire

Vérifie :

- que l'objet existe dans l'inventaire projet ;
- que la zone ou l'objet visible utilise le bon objet lié ;
- que le mode d'interaction inclut l'inventaire ;
- qu'une règle logique ne remplace pas l'action.

### Une transition du plan est signalée manquante

Le plan indique une liaison entre deux pièces, mais aucune zone d'action ne relié réellement les scènes. Ajoute une zone dans la scène de départ vers la scène cible, ou valide l'aller simple si c'est volontaire.

### Une fin secrète n'apparaît jamais

Vérifie la réponse dans la conversation : condition d'affichage, objet requis, choix précédent, énigme résolue ou variable d'histoire. Va ensuite dans **Narration** pour repérer une condition incomplète ou une variable jamais modifiée, puis dans **Plan > Logique narrative** pour voir où cette fin se situe dans le parcours.

### Une variable d'histoire ne semble pas fonctionner

Vérifie que la variable est écrite exactement pareil partout. `confiance_guide` et `confiance_du_guide` sont deux variables différentes. Vérifie aussi que la réponse qui modifie la variable est bien cliquée avant la réponse qui la teste. L'onglet **Narration** liste les variables détectées et signale celles qui sont testées sans être modifiées.

### Le joueur reste bloqué

Ajoute un indice dans :

- le dialogue d'une zone ;
- le message d'échec d'une énigme ;
- une image pop-up ;
- une cinématique courte ;
- un objet visible ;
- une règle dé deuxième clic.

Si plusieurs testeurs restent bloqués au même endroit, le problème vient rarement d'eux. Ajoute un indice plus tôt, rends l'objet plus visible, simplifie le dialogue ou ajoute une deuxième réaction après un clic inutile.


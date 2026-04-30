import { makeCinematic, makeCombination, makeEnigma, makeLogicRule, makeRouteMap } from './projectData';

export const BUILDER_TUTORIAL_TABS = ['profile', 'scenes', 'editor', 'map', 'cinematics', 'combinations', 'enigmas', 'logic', 'ai'];

const makeTutorialEndStep = (tab, selector) => ({
  tab,
  selector,
  title: 'A toi de jouer',
  body: 'Bravo {name}, tu as fait le tour de ce parcours. Familiarise-toi tranquillement avec cet environnement, puis cree ton propre projet depuis Profil. PS : ce projet-ci ne sera pas enregistre.',
  action: 'Clique sur Terminer quand tu es pret a explorer librement.',
  celebration: true,
});

export const BUILDER_TUTORIAL_STEPS = [
  {
    tab: 'profile',
    selector: '[data-tour="profile-header"]',
    title: 'Bienvenue dans le profil',
    body: 'Ici, tu retrouves ton espace de depart. C est la page qui sert a creer, reprendre, importer, tester et publier tes escape games.',
    action: 'Clique dans l en-tete du profil pour commencer le tour.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-status"]',
    title: 'Etat du compte',
    body: 'Ce petit message indique ce qui vient de se passer : projet charge, sauvegarde, import, publication ou erreur. Garde toujours un oeil dessus apres une action importante.',
    action: 'Clique sur la zone de statut pour la reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-gallery"]',
    title: 'Galerie publique',
    body: 'La galerie publique permet de voir les jeux publies. C est pratique pour tester ce que les joueurs verront et pour retrouver les creations partagees.',
    action: 'Repere le bouton Galerie publique. Tu pourras l ouvrir quand tu voudras visiter les jeux publies.',
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-tutorial-menu"]',
    title: 'Didacticiels',
    body: 'Ce menu contient les parcours d apprentissage. Tu peux choisir Profil, Scenes, Editeur, Plan, Cinematiques, Combinaisons, Enigmes, Logique ou IA selon ce que tu veux apprendre.',
    action: 'Clique sur Didacticiel pour le reperer. Le menu reste bloque pendant ce parcours pour garder le fil.',
    completeWhen: { type: 'interact' },
    preventTargetAction: true,
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-create-section"]',
    title: 'Creer un projet',
    body: 'Pour commencer un nouveau jeu, donne-lui un nom clair. Exemple : Le manoir oublie. Le nom aide surtout a retrouver le bon projet plus tard.',
    action: 'Clique dans la zone Nouveau projet.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-template-picker"]',
    title: 'Choisir un template',
    body: 'Un template pose une base de depart : vide si tu veux tout construire, ou un theme si tu veux gagner du temps. Tu pourras tout modifier ensuite dans le builder.',
    action: 'Clique sur les templates pour voir les choix.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-create-button"]',
    title: 'Bouton Creer',
    body: 'Ce bouton cree le projet et t envoie dans l editeur. Le didacticiel ne force pas cette action, pour ne pas creer un projet sans te demander.',
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-import-section"]',
    title: 'Importer un JSON',
    body: 'Si tu as une sauvegarde de projet, tu peux l importer ici. C est utile pour recuperer un projet exporte, le transferer ou repartir d une ancienne version.',
    action: 'Repere la zone Importer. Le didacticiel ne force pas l ouverture de tes fichiers.',
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-projects-section"]',
    title: 'Mes projets',
    body: 'Cette section liste tes projets sauvegardes. Tu y vois le projet actif, la date de modification, quelques controles de qualite et les actions rapides.',
    action: 'Clique dans la section Mes projets.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-project-filters"]',
    title: 'Rechercher et trier',
    body: 'Quand tu as plusieurs jeux, utilise la recherche et le tri pour retrouver vite le bon projet : par nom, creation recente ou modification recente.',
    action: 'Clique dans la recherche ou le tri.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-project-list"]',
    title: 'Carte de projet',
    body: 'Chaque carte resume un jeu. Les compteurs signalent les scenes, les zones non reliees et les enigmes sans solution. C est un premier controle avant de publier.',
    action: 'Clique dans la liste des projets.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-project-actions"]',
    fallbackSelector: '[data-tour="profile-project-list"]',
    title: 'Reprendre et organiser',
    body: 'Reprendre ouvre le projet dans le builder. Renommer change son titre, Dupliquer cree une copie, Supprimer efface le projet. Supprimer est irreversible, donc a utiliser avec prudence.',
    action: 'Repere ces actions. Ne clique sur Supprimer que si tu veux vraiment effacer un projet.',
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-project-publish"]',
    fallbackSelector: '[data-tour="profile-project-list"]',
    title: 'Tester et partager',
    body: 'Tester lance le jeu comme un joueur. Copier le lien prepare un lien jouable. Publier rend le jeu disponible dans la galerie si les reglages publics sont prets.',
    action: 'Repere Tester, Copier le lien et Publier avant de les utiliser pour de vrai.',
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-public-settings"]',
    fallbackSelector: '[data-tour="profile-project-list"]',
    title: 'Reglages publics',
    body: 'Avant publication, choisis une categorie, une mention d age et une miniature. Ces informations aident les joueurs a comprendre le type de jeu avant de l ouvrir.',
    action: 'Lis ces reglages : ils deviennent importants juste avant de publier.',
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-logout"]',
    title: 'Deconnexion',
    body: 'Ce bouton ferme la session. Avant de te deconnecter, verifie simplement que le statut indique bien que tes changements sont sauvegardes.',
  },
  {
    tab: 'profile',
    selector: '[data-tour="profile-header"]',
    title: 'Pret a commencer',
    body: 'Bravo {name}, tu connais maintenant les bases du profil. Tu peux creer un nouveau projet, reprendre un jeu existant, importer une sauvegarde ou lancer un didacticiel plus precis quand tu veux apprendre une partie du builder.',
    action: 'Clique sur Terminer pour revenir au profil et choisir ta prochaine action.',
    celebration: true,
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-name"]',
    title: 'Nom de la scene',
    body: 'On commence tranquille, {name}. Donne un petit nom a ta scene, quelque chose que tu reconnaitras vite quand ton jeu aura grandi. Exemple : Salon du grand-pere.',
    action: 'Ecris au moins 3 caracteres dans le champ. Tu peux essayer : Salon du grand-pere.',
    completeWhen: { type: 'input-min', selector: '[data-tour="scene-name"] input', min: 3 },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-act"]',
    title: 'Ranger dans un acte',
    body: 'Ici, tu ranges ta scene dans un chapitre. Pense aux actes comme aux grandes etapes de ton histoire.',
    action: 'Ouvre le menu Acte ou clique dans cette zone pour confirmer que tu as repere le rangement.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-intro"]',
    title: 'Introduction',
    body: 'C est le premier souffle de la scene. Ecris ce que le joueur ressent ou remarque en arrivant. Exemple : Une horloge arretee domine la piece.',
    action: 'Ecris une petite phrase d introduction. Tu peux essayer : Une horloge arretee domine la piece.',
    completeWhen: { type: 'input-min', selector: '[data-tour="scene-intro"] input', min: 10 },
  },
  {
    tab: 'scenes',
    tutorial: 'scenes',
    selector: '[data-tour-tab="media"]',
    title: 'Passer aux medias',
    body: 'Maintenant, {name}, on prepare l ambiance au bon endroit. Clique sur Media : c est la que vivent les images de scene, les effets et la musique.',
    action: 'Clique sur l onglet Media.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour="media-background-image"]',
    title: 'Image de la scene',
    body: 'Choisis le decor principal de ta scene. Le bouton peut deja afficher un nom de fichier, c est normal : clique dessus et je t ouvre la fausse fenetre Windows avec les images du projet.',
    action: 'Clique sur le bouton de l image de fond, puis choisis une image du projet.',
    completeWhen: { type: 'fake-file', target: 'scene-background' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour="media-visual-effect"]',
    title: 'Effet visuel',
    body: 'Une image montre le lieu. Un effet donne la sensation. Choisis une ambiance visible, meme simple, pour voir tout de suite ce que ca change.',
    action: 'Choisis un effet autre que Aucune.',
    completeWhen: { type: 'project-scene-field-not', field: 'visualEffect', value: 'none' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour="media-music"]',
    title: 'Musique',
    body: 'Derniere couche d ambiance : le son. Prends une musique exemple, juste pour comprendre comment elle s attache a la scene.',
    action: 'Clique sur Importer une musique, puis choisis un son.',
    completeWhen: { type: 'fake-file', target: 'scene-music' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour-tab="scenes"]',
    title: 'Retour a la scene',
    body: 'Parfait. Maintenant on retourne dans Scenes pour voir le vrai resultat dans l editeur, avec ton image et l effet que tu viens de choisir.',
    action: 'Clique sur l onglet Scenes.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'scenes',
    selector: '[data-tour="scene-canvas"]',
    title: 'Image plus effet',
    body: 'Regarde le rendu dans l editeur : ton decor est pose, et l effet visuel est applique dessus. C est exactement le retour qu il faut avant de continuer.',
    action: 'Clique une fois sur l editeur pour valider que tu as vu le resultat.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="inventory"]',
    title: 'Inventaire',
    body: 'Les objets sont les petits moteurs d un escape game. Une cle, une note, une torche : chacun peut servir plus tard.',
    action: 'Clique sur la zone Inventaire pour la reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-create"]',
    title: 'Creer un objet',
    body: 'On va creer un vrai objet d inventaire. C est souvent comme ca qu on donne au joueur une cle, une preuve ou un indice.',
    action: 'Clique sur + Objet.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-name"]',
    title: 'Nommer l objet',
    body: 'Donne-lui un nom lisible pour le joueur. Exemple : Cle rouillee.',
    action: 'Ecris au moins 3 caracteres. Tu peux essayer : Cle rouillee.',
    completeWhen: { type: 'input-min', selector: '[data-tour="object-name"]', min: 3 },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-image"]',
    title: 'Choisir une image',
    body: 'Pour apprendre sans toucher a tes vrais fichiers, je t ouvre une fausse fenetre Windows. Choisis une image exemple pour ton objet.',
    action: 'Choisis une image dans la fausse fenetre Windows.',
    completeWhen: { type: 'fake-file' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-image"]',
    title: 'Petite astuce image',
    body: 'Astuce pour la suite, {name} : quand tu peux, choisis des images sans fond, comme des PNG transparents. Elles se fondent beaucoup mieux dans le decor et ton objet aura l air vraiment pose dans la scene.',
    action: 'Clique sur le bouton Suivant quand tu as garde cette astuce en tete.',
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-add-menu"]',
    title: 'Ajouter l objet dans la scene',
    body: 'Ton objet existe maintenant dans l inventaire. Super. Maintenant on va le poser dans la scene pour que le joueur puisse le voir et le ramasser.',
    action: 'Clique sur le menu Ajouter dans la barre de l editeur.',
    completeWhen: { type: 'details-open', selector: '[data-tour="scene-add-menu"]' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-add-visible-object"]',
    title: 'Objet visible',
    body: 'Choisis Objet visible. Le builder va reprendre le nom et l image de ton objet, puis le placer au centre du canvas.',
    action: 'Clique sur Objet visible.',
    completeWhen: { type: 'project-scene-object-created' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-object-on-canvas"]',
    title: 'Placer l objet',
    body: 'Le voila dans la scene. Attrape-le et deplace-le a l endroit qui te semble logique. C est comme ca que tu caches une cle, une note ou un indice.',
    action: 'Fais glisser l objet dans le canvas pour le placer.',
    completeWhen: { type: 'project-scene-object-moved' },
  },
  makeTutorialEndStep('scenes', '[data-tour="scene-canvas"]'),
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-canvas"]',
    title: 'Editeur de scene',
    body: 'Ici, {name}, tu construis ce que le joueur verra vraiment. Le decor sert de base, puis tu poses dessus des zones cliquables, des objets visibles et des effets locaux.',
    action: 'Clique une fois dans l editeur pour prendre tes reperes.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-menu"]',
    title: 'Menu Ajouter',
    body: 'Ce menu est ta petite boite a outils du canvas. On va commencer par une zone d action : une partie invisible ou visible que le joueur pourra cliquer.',
    action: 'Ouvre le menu Ajouter.',
    completeWhen: { type: 'details-open', selector: '[data-tour="scene-add-menu"]' },
    autoNext: true,
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-hotspot"]',
    title: 'Zone d action',
    body: 'Choisis Zone d action. Le builder va poser une nouvelle zone au centre, puis on la deplacera ensemble.',
    action: 'Clique sur Zone d action.',
    completeWhen: { type: 'project-hotspot-created' },
    autoNext: true,
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-on-canvas"]',
    title: 'Placer la zone',
    body: 'La zone est maintenant dans le canvas. Deplace-la sur un endroit qui pourrait reagir au clic : une porte, un tiroir, un tableau, un detail curieux.',
    action: 'Fais glisser la zone dans le canvas.',
    completeWhen: { type: 'project-hotspot-moved' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="selected-zone-panel"]',
    title: 'Zone selectionnee',
    body: 'Ce panneau est la fiche complete de la zone. Tu y retrouves son nom, sa position, sa taille, l action au clic, le dialogue, les destinations, les enigmes, les sons et les images liees.',
    action: 'Clique dans ce panneau pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-geometry"]',
    title: 'Position et taille',
    body: 'X et Y placent le centre de la zone. Largeur et hauteur reglent la surface cliquable. C est utile pour rendre une cible confortable, surtout sur mobile.',
    action: 'Clique dans les reglages de position ou de taille.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-action"]',
    title: 'Action au clic',
    body: 'L action decide ce que la zone fait pour le joueur : parler, donner un objet, changer de scene ou lancer une cinematique. Pour l instant, garde Dialogue, c est parfait pour tester.',
    action: 'Ouvre le menu Action pour voir les choix, puis garde Dialogue pour ce test.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-dialogue"]',
    title: 'Dialogue de zone',
    body: 'Ecris le retour que le joueur lira quand il clique ici. Exemple : Le bois grince, mais le tiroir reste bloque.',
    action: 'Ecris au moins 8 caracteres. Tu peux essayer : Le bois grince, mais rien ne bouge.',
    completeWhen: { type: 'input-min', selector: '[data-tour="hotspot-dialogue"]', min: 8 },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-target-scene"]',
    title: 'Scene cible',
    body: 'Ce champ sert quand l action est Changer de scene. Tu peux envoyer le joueur vers une autre piece, un gros plan, un tiroir ouvert ou une version modifiee du lieu.',
    action: 'Clique sur Scene cible pour voir ou se choisit la destination.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-target-cinematic"]',
    title: 'Cinematique cible',
    body: 'Ici, tu peux lancer une cinematique apres le clic. C est utile pour une revelation, une transition dramatique ou une petite recompense narrative.',
    action: 'Clique sur Cinematique cible pour reperer ce choix.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-linked-enigma"]',
    title: 'Enigme liee',
    body: 'Une enigme liee bloque la zone tant que le joueur ne l a pas resolue. Par exemple : cliquer sur un coffre peut ouvrir directement un code a entrer.',
    action: 'Clique sur Enigme liee pour voir ou connecter une enigme.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-sound"]',
    title: 'Son de la zone',
    body: 'Ce son se joue au moment du clic. Garde-le court : un grincement, un verrou, un bip, un souffle. C est une petite couche qui rend l interaction plus vivante.',
    action: 'Clique sur le bouton du son pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-object-image"]',
    title: 'Image objet',
    body: 'Cette image peut accompagner l interaction, par exemple pour montrer un indice trouve ou un objet observe de pres. Elle aide le joueur a comprendre ce qu il vient de decouvrir.',
    action: 'Clique sur le bouton Image objet pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-menu"]',
    title: 'Ajouter une zone visuelle',
    body: 'Maintenant, on ajoute une zone visuelle. Elle ne remplace pas l action : elle sert a attirer l oeil, ajouter une ambiance ou signaler un endroit important.',
    action: 'Ouvre a nouveau le menu Ajouter.',
    completeWhen: { type: 'details-open', selector: '[data-tour="scene-add-menu"]' },
    autoNext: true,
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-visual-zone"]',
    title: 'Zone visuelle',
    body: 'Choisis Zone visuelle. Elle va apparaitre dans le canvas avec un effet local que tu pourras placer ou regler ensuite.',
    action: 'Clique sur Zone visuelle.',
    completeWhen: { type: 'project-visual-zone-created' },
    autoNext: true,
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="visual-zone-effect"]',
    title: 'Effet de la zone',
    body: 'Maintenant, choisis l ambiance locale de cette zone. Prends un effet visible, autre que celui deja pose, pour voir tout de suite comment il transforme un endroit precis de la scene.',
    action: 'Ouvre le menu Effet de zone et choisis un autre effet.',
    completeWhen: { type: 'project-visual-zone-effect-not', value: 'sparkles' },
    autoNext: true,
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="visual-zone-on-canvas"]',
    title: 'Placer l effet',
    body: 'Deplace cette zone visuelle autour de l endroit que tu veux faire ressortir. C est pratique pour un reflet, une poussiere magique, une lumiere ou une zone suspecte.',
    action: 'Fais glisser la zone visuelle dans le canvas.',
    completeWhen: { type: 'project-visual-zone-moved' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-preview-button"]',
    title: 'Voir le resultat',
    body: 'On passe maintenant en test direct. C est la meilleure habitude a prendre : tu construis, puis tu previsualises tout de suite comme un joueur.',
    action: 'Clique sur le bouton Previsualiser de la scene.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'preview',
    tutorial: 'editor',
    selector: '[data-tour="preview-player"]',
    title: 'Resultat jouable',
    body: 'Voila le rendu cote joueur. Ta scene, tes zones et tes effets doivent se comprendre ici, sans avoir besoin de regarder les reglages.',
    action: 'Clique une fois dans le preview pour valider que tu as vu le resultat.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'preview',
    tutorial: 'editor',
    selector: '[data-tour="preview-player"]',
    title: 'A toi de jouer',
    body: 'Bravo {name}, tu as fait le tour de ce parcours. Familiarise-toi tranquillement avec cet environnement, puis cree ton propre projet depuis Profil. PS : ce projet-ci ne sera pas enregistre.',
    action: 'Clique sur Terminer quand tu es pret a explorer librement.',
    celebration: true,
  },
  {
    tab: 'media',
    selector: '[data-tour-tab="media"]',
    title: 'Medias',
    body: 'L onglet Media rassemble les images, sons et fonds utilises par tes scenes.',
  },
  {
    tab: 'map',
    selector: '[data-tour="map-add-room"]',
    title: 'Ajouter des pieces',
    body: 'On va dessiner le chemin du joueur. Ajoute une piece a la main, ou laisse le builder partir de tes scenes existantes.',
    action: 'Clique sur Piece ou Depuis scenes.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'map',
    selector: '[data-tour="map-board"]',
    title: 'Organiser la carte',
    body: 'Cette carte t aide a voir ton jeu d un seul coup d oeil. Elle sert aussi a verifier que les connexions entre les differentes pieces sont bien presentes. Deplace les pieces comme si tu posais le plan sur une table.',
    action: 'Clique une piece sur la carte.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'map',
    selector: '[data-tour="map-room-detail"]',
    title: 'Lier une scene',
    body: 'Chaque piece peut pointer vers une vraie scene. C est le pont entre ton plan mental et le jeu jouable.',
    action: 'Clique dans le detail ou modifie un champ de la piece.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'map',
    selector: '[data-tour="map-diagnostics"]',
    title: 'Verifier les liaisons',
    body: 'Cette partie joue un peu le role du copilote. Elle te montre ce qui risque de coincer avant que les joueurs le decouvrent.',
  },
  makeTutorialEndStep('map', '[data-tour="map-diagnostics"]'),
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-sidebar"]',
    title: 'Cinematiques',
    body: 'Ici, tu prepares les moments non jouables : intro, souvenir, revelation, transition entre deux pieces ou petite scene de fin. Une cinematique sert a raconter quelque chose sans demander au joueur de cliquer partout.',
    action: 'Clique dans la colonne des cinematiques pour la reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-add"]',
    title: 'Creer une cinematique',
    body: 'Le bouton ajoute une nouvelle sequence. Dans un escape game, tu peux t en servir pour ouvrir l histoire, montrer une consequence apres une enigme, ou changer de chapitre avec un peu de mise en scene.',
    action: 'Clique sur + Cinematique.',
    completeWhen: { type: 'interact' },
    autoNext: true,
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-list"]',
    title: 'Liste des sequences',
    body: 'Chaque carte est une cinematique de ton projet. Le nombre de slides te dit vite si c est une courte transition ou une vraie petite scene narrative.',
    action: 'Clique une cinematique dans la liste.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-name"]',
    title: 'Nom clair',
    body: 'Donne un nom utile pour toi, pas seulement joli. Exemple : Intro reveil, Revelation du coffre, Fin chapitre 1. Plus tard, tu retrouveras ce nom dans les zones d action et les choix de logique.',
    action: 'Ecris un nom d au moins 3 caracteres.',
    completeWhen: { type: 'input-min', selector: '[data-tour="cinematic-name"]', min: 3 },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-type"]',
    title: 'Type de cinematique',
    body: 'Diaporama sert a enchainer des images avec du texte, comme une BD ou un storyboard. Video importee sert si tu as deja un fichier video pret. Pour apprendre, garde Diaporama : c est le plus souple.',
    action: 'Ouvre le menu Type pour voir les deux formats, puis garde Diaporama.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-add-slide"]',
    title: 'Ajouter un slide',
    body: 'Un slide, c est une image plus une phrase. Plusieurs slides creent le rythme : plan large, detail, revelation, puis retour au jeu.',
    action: 'Clique sur + Slide pour ajouter une image narrative.',
    completeWhen: { type: 'interact' },
    autoNext: true,
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-slides"]',
    title: 'Ordre des slides',
    body: 'Lis cette zone de gauche a droite : c est l ordre dans lequel le joueur verra la sequence. Une bonne cinematique reste courte et chaque slide doit apporter une information.',
    action: 'Clique dans la zone des slides pour la reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-slide-image"]',
    title: 'Image du slide',
    body: 'L image pose l ambiance. Elle peut montrer un lieu, un objet important, une reaction de personnage ou un detail que le joueur doit retenir.',
    action: 'Clique sur le bouton image du premier slide pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-slide-narration"]',
    title: 'Narration',
    body: 'La narration donne le sens de l image. Ecris comme si tu accompagnais un ami dans l histoire : court, clair, avec une petite emotion ou une information utile.',
    action: 'Ecris au moins 10 caracteres dans la narration.',
    completeWhen: { type: 'input-min', selector: '[data-tour="cinematic-slide-narration"]', min: 10 },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-slide-audio"]',
    title: 'Son du slide',
    body: 'Le son est optionnel, mais il peut beaucoup aider : une voix, un bruit de porte, une note musicale, un souffle. Garde-le court pour ne pas ralentir le rythme.',
    action: 'Clique sur le bouton son pour voir ou il se place.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-end-action"]',
    title: 'Action de fin',
    body: 'C est tres important : quand la cinematique se termine, tu peux ne rien faire, envoyer vers un acte, ouvrir une scene ou donner un objet. C est ce qui reconnecte la narration au jeu.',
    action: 'Ouvre le menu Action de fin pour voir les possibilites.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'cinematics',
    selector: '[data-tour="cinematic-start-settings"]',
    title: 'Demarrage du jeu',
    body: 'Cette zone decide si le jeu commence directement dans une scene ou par une cinematique. Utilise une cinematique de depart si tu veux poser une intro avant que le joueur controle quoi que ce soit.',
    action: 'Clique dans les reglages de demarrage pour les reperer.',
    completeWhen: { type: 'interact' },
  },
  makeTutorialEndStep('cinematics', '[data-tour="cinematic-end-settings"]'),
  {
    tab: 'combinations',
    selector: '[data-tour="combination-add"]',
    title: 'Creer une combinaison',
    body: 'Les combinaisons donnent ce petit plaisir de deduction. Deux objets, une idee, et hop : un nouveau resultat.',
    action: 'Clique sur + Combinaison.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'combinations',
    selector: '[data-tour="combination-items"]',
    title: 'Choisir les ingredients',
    body: 'Choisis les deux objets que le joueur devra rapprocher. Imagine la logique : qu est-ce qui ferait sens dans l histoire ?',
    action: 'Choisis ou confirme un objet dans les ingredients.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'combinations',
    selector: '[data-tour="combination-result"]',
    title: 'Definir le resultat',
    body: 'Le resultat, c est la recompense. Il peut devenir une cle pour la suite, au sens propre ou au sens narratif.',
    action: 'Choisis ou confirme le resultat.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'combinations',
    selector: '[data-tour="combination-message"]',
    title: 'Message joueur',
    body: 'Ecris un petit retour pour le joueur. Un bon message confirme la reussite et peut glisser un indice discret.',
    action: 'Ecris un message d au moins 8 caracteres.',
    completeWhen: { type: 'input-min', selector: '[data-tour="combination-message"]', min: 8 },
  },
  makeTutorialEndStep('combinations', '[data-tour="combination-message"]'),
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-list"]',
    title: 'Liste des enigmes',
    body: 'Bienvenue dans la fabrique a casse-tetes, {name}. Ici, tu crees les enigmes que tes zones pourront lancer.',
    action: 'Clique dans la liste des enigmes pour la prendre en main.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-identity"]',
    title: 'Nom et type',
    body: 'Donne une identite a ton enigme. Le type change la maniere dont le joueur va interagir avec elle.',
    action: 'Clique dans le nom ou le type de l enigme.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-question"]',
    title: 'Consigne',
    body: 'La consigne doit aider sans tout donner. Parle au joueur comme si tu lui tendais un indice, pas comme si tu lisais un manuel.',
    action: 'Ecris une consigne d au moins 10 caracteres.',
    completeWhen: { type: 'input-min', selector: '[data-tour="enigma-question"]', min: 10 },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-solution"]',
    title: 'Solution',
    body: 'Ici, tu poses la vraie reponse. C est le petit secret que le moteur va comparer a ce que le joueur tente.',
    action: 'Ecris une solution, meme courte.',
    completeWhen: { type: 'input-min', selector: '[data-tour="enigma-solution"]', min: 1 },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-code-appearance"]',
    title: 'Apparence du code',
    body: 'Cette partie decide comment le joueur va entrer la reponse. Le meme code peut devenir un coffre a molettes, un digicode, des cases a remplir ou une bande de papier. Ce choix change la sensation de l enigme, pas seulement son style.',
    action: 'Clique dans le bloc Apparence du code pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-code-skin"]',
    title: 'Forme cote joueur',
    body: 'Choisis la forme qui colle a ton decor. Digicode pour une porte moderne, molettes pour un coffre, cases pour un mot secret, papier pour un indice ecrit. Le joueur comprendra mieux quoi faire si la forme raconte deja quelque chose.',
    action: 'Ouvre le menu Forme cote joueur pour voir les formats.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-code-preview"]',
    title: 'Apercu joueur',
    body: 'L apercu te montre ce que le joueur verra. C est ici que tu verifies si la forme est lisible, si elle correspond a la scene, et si elle donne envie d essayer la solution.',
    action: 'Clique dans l apercu pour valider que tu l as regarde.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-popup-background"]',
    title: 'Fond de pop-up',
    body: 'Le fond de pop-up habille la fenetre de l enigme. Tu peux mettre une photo de clavier, coffre, carnet, tableau ou mecanisme pour que l enigme ait l air d exister dans le lieu.',
    action: 'Clique dans le bloc Fond de pop-up pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-popup-background-button"]',
    title: 'Image de fond',
    body: 'Ce bouton importe ou remplace l image de fond. Apres import, les reglages de zoom, position et voile aident a garder la zone d ecriture lisible.',
    action: 'Observe ce bouton : il servira a choisir l image de fond de l enigme.',
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-popup-background"]',
    title: 'Lisibilite',
    body: 'Le voile assombrit ou eclaircit l image pour que le texte et les boutons restent lisibles. Une belle image ne suffit pas : le joueur doit pouvoir lire sans forcer.',
    action: 'Garde en tete : apres avoir ajoute un fond, ajuste le voile et le zoom pour proteger la lisibilite.',
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-unlock"]',
    title: 'Deblocage',
    body: 'Quand le joueur reussit, il faut que le monde reagisse. Tu peux simplement valider, ouvrir une scene ou lancer une cinematique.',
    action: 'Clique dans la zone de deblocage ou change un select.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-preview-button"]',
    title: 'Previsualiser',
    body: 'Avant de relier ton enigme a une zone d action, teste-la comme un joueur. C est le meilleur moyen de verifier si la consigne, la solution et l apparence du code sont vraiment claires.',
    action: 'Clique sur Previsualiser pour lancer le test de cette enigme.',
    completeWhen: { type: 'interact' },
  },
  makeTutorialEndStep('enigmas', '[data-tour="enigma-unlock"]'),
  {
    tab: 'logic',
    selector: '[data-tour="logic-scene-tree"]',
    title: 'Choisir la scene',
    body: 'La logique peut impressionner au debut, mais on va y aller doucement. D abord, choisis la scene dont tu veux regler le comportement.',
    action: 'Clique une scene dans la colonne.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-zones"]',
    title: 'Zones d action',
    body: 'Chaque zone peut avoir une action simple, puis des exceptions. C est comme dire : normalement cette porte parle, mais si le joueur a la cle, elle s ouvre.',
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-add-rule"]',
    title: 'Ajouter une regle',
    body: 'Une regle, c est un petit â€œsi... alors...â€. Si le joueur a tel objet, alors la zone reagit autrement.',
    action: 'Clique sur + Regle.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-condition"]',
    title: 'Condition',
    body: 'La condition est le declencheur. Prends ton temps ici : c est souvent ce qui fait qu une enigme devient vraiment satisfaisante.',
    action: 'Ouvre le menu Condition et choisis ce qui doit etre vrai.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-action"]',
    title: 'Action declenchee',
    body: 'Maintenant, choisis la consequence. Dialogue affiche juste un texte. Dialogue + objet peut donner une recompense. Changer de scene ouvre une destination. Lancer une cinematique declenche une sequence narrative.',
    action: 'Ouvre le menu Action declenchee et choisis autre chose que Dialogue pour voir la suite apparaitre.',
    completeWhen: { type: 'select-not', selector: '[data-tour="logic-action"]', value: 'dialogue' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-reward-item"]',
    title: 'Objet donne',
    body: 'Ce champ ajoute un objet a l inventaire quand la regle s active. Utilise-le pour recompenser une bonne action : cle trouvee, indice obtenu, carte revelee.',
    action: 'Ouvre le menu Objet donne si ta regle doit donner une recompense.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-dialogue"]',
    title: 'Dialogue affiche',
    body: 'Ce message remplace le dialogue normal de la zone quand la condition est vraie. Il doit dire au joueur ce qui vient de se passer ou pourquoi la zone reagit autrement.',
    action: 'Ecris ou confirme un message court pour cette regle.',
    completeWhen: { type: 'input-min', selector: '[data-tour="logic-dialogue"]', min: 6 },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-action"]',
    title: 'La suite depend du choix',
    body: 'Si tu choisis Changer de scene, le champ Scene cible apparait. Si tu choisis Lancer une cinematique, le champ Cinematique cible apparait. Pour Dialogue ou Dialogue + objet, le message et l objet donne suffisent.',
    action: 'Garde cette logique en tete : le panneau s adapte au type d action choisi.',
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-target-scene"]',
    title: 'Scene cible',
    body: 'Quand l action est Changer de scene, ce champ choisit ou envoyer le joueur. Par exemple : une porte peut mener au couloir, un tiroir peut ouvrir un gros plan, une trappe peut envoyer vers une cave.',
    action: 'Choisis une scene cible pour cette regle.',
    completeWhen: { type: 'select-has-value', selector: '[data-tour="logic-target-scene"]' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-visible-objects"]',
    title: 'Objets visibles',
    body: 'Les objets visibles peuvent eux aussi raconter quelque chose : une image a inspecter, un objet a ramasser, ou un indice qui disparait apres usage.',
  },
  makeTutorialEndStep('logic', '[data-tour="logic-visible-objects"]'),
  {
    tab: 'score',
    selector: '[data-tour-tab="score"]',
    title: 'Bilan',
    body: 'Consulte la qualite globale du projet et les points a corriger avant de publier.',
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-credits"]',
    title: 'IA',
    body: 'Bienvenue dans l assistant IA, {name}. Il peut transformer une idee en base de jeu, continuer un projet, ameliorer une scene ou preparer des images. Certaines actions consomment des credits : le plus important est de toujours voir le cout avant de lancer.',
    action: 'Clique dans le bloc Credits IA pour reperer le solde et le cout estime.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-mode"]',
    title: 'Choisir le bon mode',
    body: 'Le mode choisit la facon de travailler avec l IA. Generer cree une premiere base. Progressif avance etape par etape. Continuer prolonge ce qui existe deja. Ameliorer retouche une scene precise sans remplacer tout le projet.',
    action: 'Clique sur les modes pour voir comment l onglet change.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-estimate"]',
    title: 'Ce qui va changer',
    body: 'Avant de lancer l IA, cette zone resume ce qui risque de bouger : scenes ajoutees, objets, enigmes, dialogues ou correction locale. Lis-la comme une petite checklist avant de depenser des credits.',
    action: 'Clique dans le resume des modifications probables.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-visual-style"]',
    title: 'Direction artistique',
    body: 'Le style visuel global guide les images de scene. Plus il est clair, plus le resultat paraitra coherent : meme epoque, meme lumiere, meme ambiance. C est ce qui donne une impression professionnelle au projet genere.',
    action: 'Ecris ou ajuste quelques mots de style visuel.',
    completeWhen: { type: 'input-min', selector: '[data-tour="ai-visual-style"]', min: 8 },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-image-readability"]',
    title: 'Images jouables',
    body: 'Une belle image sombre peut etre injouable si les objets et sorties sont invisibles. Ce reglage protege la lisibilite : ambiance sombre, lisibilite renforcee, tres lumineux, ou aucune correction.',
    action: 'Ouvre le menu Lisibilite des images pour voir les options.',
    completeWhen: { type: 'select-touched' },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-visual-inheritance"]',
    title: 'Coherence entre scenes',
    body: 'L heritage visuel dit a l IA ce qui doit rester constant : portes, parquet, materiaux, lumiere, style des meubles. Sans ca, chaque image peut ressembler a un autre jeu.',
    action: 'Clique dans l heritage visuel pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-generate-button"]',
    title: 'Lancer la generation',
    body: 'Ce bouton envoie vraiment la demande a l IA. Avant de cliquer, verifie le mode, le cout, le theme, les quantites et le style visuel. Le didacticiel ne force pas ce clic pour eviter de consommer des credits par accident.',
    action: 'Repere le bouton de lancement. Ne clique que si tu veux vraiment consommer des credits.',
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-output"]',
    title: 'Brouillon IA',
    body: 'Le resultat arrive ici comme un brouillon, pas comme une modification immediate. Tu peux prendre le temps de lire, verifier, garder cette version ou repartir sur une autre idee.',
    action: 'Clique dans la zone de brouillon IA.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-draft-actions"]',
    title: 'Sauvegarder ou repartir',
    body: 'Ces boutons servent a garder un brouillon ou a en ouvrir un nouveau. C est pratique pour comparer deux pistes avant de choisir celle qui colle le mieux a ton escape game.',
    action: 'Clique dans les actions de brouillon pour les reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-output"]',
    title: 'Modifications prevues',
    body: 'Quand un resultat existe, cette zone indique ce que l IA a ajoute ou modifie : scenes, objets, enigmes, cinematiques. C est le controle qualite rapide avant application.',
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-output"]',
    title: 'Validation automatique',
    body: 'La validation signale les erreurs bloquantes ou les avertissements. Elle evite d appliquer un projet incoherent, par exemple une scene introuvable ou une reference cassee.',
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-images-info"]',
    title: 'Images a la demande',
    body: 'Les images de scenes et d objets peuvent etre generees apres le texte. C est ce qui rend le projet beaucoup plus concret, mais chaque image peut consommer des credits : choisis seulement celles dont tu as vraiment besoin.',
  },
  {
    tab: 'ai',
    selector: '[data-tour="ai-apply-button"]',
    title: 'Appliquer au projet',
    body: 'Ce bouton applique le brouillon IA au projet. Tant que tu ne cliques pas ici, le projet actuel reste intact. C est le bon moment pour relire une derniere fois avant de valider.',
  },
  makeTutorialEndStep('ai', '[data-tour="ai-output"]'),
  {
    tab: 'shop',
    selector: '[data-tour-tab="shop"]',
    title: 'Boutique',
    body: 'Retrouve les options liees aux contenus et services complementaires du builder.',
  },
  {
    tab: 'preview',
    selector: '[data-tour-tab="preview"]',
    title: 'Preview',
    body: 'Teste ton jeu comme un joueur avant de le publier, pour verifier les dialogues, enigmes et transitions.',
  },
];

export const getTutorialStepIndexes = (tab) => BUILDER_TUTORIAL_STEPS
  .map((step, index) => ({ step, index }))
  .filter(({ step }) => (step.tutorial || step.tab) === tab)
  .map(({ index }) => index);

const getProjectRecordName = (project) =>
  project?.name || project?.data?.title || project?.data?.name || '';

export const getTutorialName = (user) => {
  const label = user?.name || user?.pseudo || user?.username || user?.email?.split('@')?.[0] || '';
  return String(label || '').trim();
};

export const personalizeTutorialText = (text, userName) => String(text || '').replaceAll('{name}', userName || 'toi');

export const getTutorialInputValue = (selector) => {
  const field = document.querySelector(selector);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value || '';
  }
  return '';
};

export const getTutorialInputField = (selector) => {
  const target = document.querySelector(selector);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return target;
  }
  return target?.querySelector?.('input, textarea, select') || null;
};

export const doRectsOverlap = (a, b, padding = 0) => (
  a.left < b.left + b.width + padding
  && a.left + a.width + padding > b.left
  && a.top < b.top + b.height + padding
  && a.top + a.height + padding > b.top
);

const getSelectedTutorialScene = (project) => (project?.scenes || [])[0] || null;

export const isTutorialStepComplete = (step, interactedSteps, project) => {
  if (!step?.completeWhen) return true;
  const rule = step.completeWhen;
  if (rule.type === 'interact') return interactedSteps.has(step.selector);
  if (rule.type === 'select-touched') return interactedSteps.has(step.selector);
  if (rule.type === 'fake-file') return interactedSteps.has(`fake-file:${step.selector}`);
  if (rule.type === 'input-min') return getTutorialInputValue(rule.selector).trim().length >= (rule.min || 1);
  if (rule.type === 'select-not') return getTutorialInputValue(rule.selector) !== rule.value;
  if (rule.type === 'select-has-value') return getTutorialInputValue(rule.selector).trim().length > 0;
  if (rule.type === 'details-open') return Boolean(document.querySelector(`${rule.selector}[open]`));
  if (rule.type === 'project-scene-field-not') {
    const scene = getSelectedTutorialScene(project);
    return Boolean(scene && (scene[rule.field] || '') !== rule.value);
  }
  if (rule.type === 'project-scene-object-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.sceneObjects || []).some((object) => object.tutorialCreated));
  }
  if (rule.type === 'project-scene-object-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.sceneObjects || []).filter((object) => object.tutorialCreated).some((object) => (
      Math.abs((Number(object.x) || 0) - 50) > 1 || Math.abs((Number(object.y) || 0) - 50) > 1
    )));
  }
  if (rule.type === 'project-hotspot-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.hotspots || []).some((hotspot) => hotspot.tutorialCreated));
  }
  if (rule.type === 'project-hotspot-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.hotspots || []).filter((hotspot) => hotspot.tutorialCreated).some((hotspot) => (
      Math.abs((Number(hotspot.x) || 0) - 50) > 1 || Math.abs((Number(hotspot.y) || 0) - 50) > 1
    )));
  }
  if (rule.type === 'project-visual-zone-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).some((zone) => zone.tutorialCreated));
  }
  if (rule.type === 'project-visual-zone-effect-not') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).filter((zone) => zone.tutorialCreated).some((zone) => (
      (zone.effect || '') !== rule.value
    )));
  }
  if (rule.type === 'project-visual-zone-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).filter((zone) => zone.tutorialCreated).some((zone) => (
      Math.abs((Number(zone.x) || 0) - 50) > 1 || Math.abs((Number(zone.y) || 0) - 50) > 1
    )));
  }
  return true;
};

export const makeTutorialImageDataUrl = (label, color) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="28" fill="#111827"/>
      <rect x="34" y="42" width="172" height="136" rx="16" fill="${color}"/>
      <circle cx="84" cy="88" r="22" fill="#f8fafc" opacity=".9"/>
      <path d="M50 162 L98 118 L132 146 L158 112 L198 162 Z" fill="#f8fafc" opacity=".82"/>
      <text x="120" y="210" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#e5e7eb">${label}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const makeTutorialFileIconDataUrl = (label, color = '#2563eb') => makeTutorialImageDataUrl(label, color);

const FAKE_WINDOWS_IMAGES = [
  { name: 'cle-rouillee.png', label: 'Cle', color: '#b45309' },
  { name: 'lettre-cachetee.png', label: 'Lettre', color: '#7c3aed' },
  { name: 'montre-arretee.png', label: 'Montre', color: '#2563eb' },
];

const FAKE_WINDOWS_AUDIO = [
  {
    name: 'ambiance-manoir.mp3',
    label: 'Ambiance manoir',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
  {
    name: 'tic-tac-sourd.mp3',
    label: 'Tic tac sourd',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
  {
    name: 'vent-couloir.mp3',
    label: 'Vent couloir',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
];

const getFakeWindowAudioOptions = (project) => {
  const tutorialAudio = Array.isArray(project?.tutorialExampleAudio) ? project.tutorialExampleAudio : [];
  const realAudio = (tutorialAudio.length ? tutorialAudio : (project?.scenes || []))
    .filter((scene) => scene.musicData)
    .map((scene) => ({
      name: scene.musicName || `${scene.name || 'musique'}.mp3`,
      label: scene.name || 'Musique',
      dataUrl: scene.musicData,
      isReal: true,
    }));

  const uniqueAudio = [];
  const seenAudio = new Set();
  realAudio.forEach((audio) => {
    const key = audio.dataUrl || audio.name;
    if (seenAudio.has(key)) return;
    seenAudio.add(key);
    uniqueAudio.push(audio);
  });

  return uniqueAudio.length ? uniqueAudio.slice(0, 1) : FAKE_WINDOWS_AUDIO.slice(0, 1);
};

export const getFakeWindowImageOptions = (project, target = 'object') => {
  if (target === 'scene-music') return getFakeWindowAudioOptions(project);
  const tutorialSceneImages = Array.isArray(project?.tutorialExampleImages) ? project.tutorialExampleImages : [];
  const source = target === 'scene-background'
    ? (tutorialSceneImages.length ? tutorialSceneImages : (project?.scenes || [])).map((scene) => ({
      imageData: scene.backgroundData,
      imageName: scene.backgroundName,
      name: scene.name,
    }))
    : (project?.items || []);

  const realImages = source
    .filter((item) => item.imageData)
    .slice(0, 6)
    .map((item) => ({
      name: item.imageName || `${item.name || 'objet'}.png`,
      label: item.name || 'Objet',
      dataUrl: item.imageData,
      isReal: true,
    }));

  if (realImages.length) return realImages;

  return FAKE_WINDOWS_IMAGES.map((file) => ({
    ...file,
    dataUrl: makeTutorialImageDataUrl(file.label, file.color),
    isReal: false,
  }));
};

export const prepareProjectForTutorial = (project, tab) => {
  const nextProject = structuredClone(project);
  if (tab === 'scenes') {
    const existingTutorialImages = Array.isArray(nextProject.tutorialExampleImages) ? nextProject.tutorialExampleImages : [];
    const existingTutorialAudio = Array.isArray(nextProject.tutorialExampleAudio) ? nextProject.tutorialExampleAudio : [];
    const sceneImageExamples = (nextProject.scenes || [])
      .filter((scene) => scene.backgroundData)
      .map((scene) => ({
        name: scene.name,
        backgroundData: scene.backgroundData,
        backgroundName: scene.backgroundName,
      }));
    const sceneAudioExamples = (nextProject.scenes || [])
      .filter((scene) => scene.musicData)
      .map((scene) => ({
        name: scene.name,
        musicData: scene.musicData,
        musicName: scene.musicName,
      }));
    nextProject.tutorialExampleImages = existingTutorialImages.length ? existingTutorialImages : sceneImageExamples;
    nextProject.tutorialExampleAudio = existingTutorialAudio.length ? existingTutorialAudio : sceneAudioExamples;
    const scene = nextProject.scenes?.[0];
    if (scene) {
      scene.name = '';
      scene.introText = '';
      scene.backgroundData = '';
      scene.backgroundName = '';
      scene.musicData = '';
      scene.musicName = '';
      scene.musicLoop = true;
      scene.visualEffect = 'none';
      if (!Array.isArray(scene.hotspots) || scene.hotspots.length === 0) {
        scene.hotspots = [{
          id: `hotspot_${Date.now().toString(36)}`,
          name: '',
          x: 50,
          y: 50,
          width: 14,
          height: 12,
          actionType: 'dialogue',
          dialogue: '',
          requiredItemId: '',
          consumeRequiredItemOnUse: false,
          rewardItemId: '',
          targetSceneId: '',
          targetCinematicId: '',
          enigmaId: '',
          requiredHotspotId: '',
          lockedMessage: '',
          objectImageData: '',
          objectImageName: '',
          hasSecondAction: false,
          secondActionType: 'dialogue',
          secondDialogue: '',
          secondRequiredItemId: '',
          secondConsumeRequiredItemOnUse: false,
          secondRewardItemId: '',
          secondTargetSceneId: '',
          secondTargetCinematicId: '',
          secondEnigmaId: '',
          secondObjectImageData: '',
          secondObjectImageName: '',
          logicRules: [],
        }];
      } else {
        scene.hotspots[0].name = '';
        scene.hotspots[0].actionType = 'dialogue';
      }
    }
  }
  if (tab === 'editor') {
    const scene = nextProject.scenes?.[0];
    if (scene) {
      scene.hotspots = (scene.hotspots || []).map((hotspot) => ({
        ...hotspot,
        tutorialCreated: false,
      }));
      scene.visualEffectZones = (scene.visualEffectZones || []).map((zone) => ({
        ...zone,
        tutorialCreated: false,
      }));
      scene.sceneObjects = (scene.sceneObjects || []).map((object) => ({
        ...object,
        tutorialCreated: false,
      }));
    }
  }
  if (tab === 'map') {
    if (!nextProject.routeMap) nextProject.routeMap = makeRouteMap();
    if (!Array.isArray(nextProject.routeMap.rooms) || nextProject.routeMap.rooms.length === 0) {
      const firstScene = nextProject.scenes?.[0];
      nextProject.routeMap.rooms = [{
        id: `room_${Date.now().toString(36)}`,
        name: firstScene?.name || 'Piece de depart',
        sceneId: firstScene?.id || '',
        x: 28,
        y: 42,
        type: 'start',
      }];
    }
  }
  if (tab === 'cinematics') {
    if (!Array.isArray(nextProject.cinematics)) nextProject.cinematics = [];
    if (!nextProject.cinematics.length) nextProject.cinematics.push(makeCinematic());
    const cinematic = nextProject.cinematics[0];
    cinematic.cinematicType = 'slides';
    if (!Array.isArray(cinematic.slides) || !cinematic.slides.length) {
      cinematic.slides = makeCinematic().slides;
    }
  }
  if (tab === 'combinations' && (!Array.isArray(nextProject.combinations) || nextProject.combinations.length === 0)) {
    if (!Array.isArray(nextProject.combinations)) nextProject.combinations = [];
    nextProject.combinations.push(makeCombination());
  }
  if (tab === 'enigmas' && (!Array.isArray(nextProject.enigmas) || nextProject.enigmas.length === 0)) {
    if (!Array.isArray(nextProject.enigmas)) nextProject.enigmas = [];
    nextProject.enigmas.push(makeEnigma());
  }
  if (tab === 'enigmas') {
    const enigma = nextProject.enigmas?.[0];
    if (enigma) {
      enigma.type = 'code';
      enigma.codeSkin = enigma.codeSkin || 'safe-wheels';
      enigma.solutionText = enigma.solutionText || '1234';
    }
  }
  if (tab === 'logic') {
    const scene = nextProject.scenes?.[0];
    const hotspot = scene?.hotspots?.[0];
    if (hotspot && (!Array.isArray(hotspot.logicRules) || hotspot.logicRules.length === 0)) {
      hotspot.logicRules = [makeLogicRule()];
    }
  }
  return nextProject;
};

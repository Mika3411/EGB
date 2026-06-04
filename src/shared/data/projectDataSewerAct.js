export const ensureSewerAct2 = (draft, helpers = {}) => {
  const {
    makeItem,
    makeCinematic,
    makeCinematicSlide,
    makeEnigma,
    makeImportedScene,
    makeImportedHotspot,
  } = helpers;
  const hasTutorialCave = draft.scenes?.some((scene) => scene.id === 'xq7f2yy0')
    && draft.cinematics?.some((cinematic) => cinematic.id === 'sgbbc0sn');
  if (!hasTutorialCave || draft.acts?.some((act) => act.id === 'act2_egouts_sous_sols')) return;

  const act2Id = 'act2_egouts_sous_sols';
  const watchId = 'bfh2n8m8';
  const rustKeyId = 'act2_cle_rouillee';
  const mapId = 'act2_plan_egouts';
  const valveId = 'act2_manivelle';
  const redBadgeId = 'act2_badge_rouge';
  const ratCinematicId = 'act2_cine_rat_temps';
  const finalCinematicId = 'act2_cine_porte_rouge';

  draft.acts.push({ id: act2Id, name: 'Acte II - Les égouts figés' });

  [
    makeItem('clé rouillée des égouts', '[]'),
    makeItem('plan humide des sous-sols', '[]'),
    makeItem('manivelle froide', '[]'),
    makeItem('badge de la porte rouge', '[]'),
  ].forEach((item, index) => {
    item.id = [rustKeyId, mapId, valveId, redBadgeId][index];
    if (!draft.items.some((entry) => entry.id === item.id)) draft.items.push(item);
  });

  const act2Entry = draft.cinematics.find((cinematic) => cinematic.id === 'sgbbc0sn');
  if (act2Entry) {
    act2Entry.name = 'Acte II - Sous la maison';
    act2Entry.onEndType = 'act';
    act2Entry.targetActId = act2Id;
    act2Entry.targetSceneId = '';
    if (act2Entry.slides?.[0]) {
      act2Entry.slides[0].narration = "La torche traverse l'endroit sombre de la cave. Le mur du fond n'est pas un mur: c'est une ouverture humide qui descend vers les égouts. Le silence est trop parfait. La montre arrêtée indique toujours 10h09.";
    }
  }

  draft.cinematics.push({
    ...makeCinematic(),
    id: ratCinematicId,
    name: 'Le rat qui reprend sa course',
    slides: [{
      ...makeCinematicSlide(),
      id: `${ratCinematicId}_slide_01`,
      narration: "Elle s'approche d'un rat figé au milieu d'une flaque noire. Pendant une seconde, rien ne bouge. Puis ses moustaches frémissent, ses pattes grattent le béton, et il détale dans un tuyau comme si le temps venait de reprendre son cours autour d'elle.",
    }],
    onEndType: 'scene',
    targetSceneId: 'act2_scene_bouche_egout',
  }, {
    ...makeCinematic(),
    id: finalCinematicId,
    name: 'La porte rouge métallique',
    slides: [{
      ...makeCinematicSlide(),
      id: `${finalCinematicId}_slide_01`,
      narration: "La porte rouge métallique s'ouvre dans un grincement lourd. Derrière, il n'y a ni cave ni maison: seulement un couloir impossible, baigné dans une lumière immobile. Elle franchit le seuil. À 10h09, quelque chose l'attend.",
    }],
    onEndType: 'none',
  });

  draft.enigmas.push({
    ...makeEnigma(),
    id: 'act2_enig_grille_1009',
    name: 'Cadran de la grille',
    question: "Le cadran rouille ne demande pas une date. Il demande l'heure exacte qui refusé d'avancer.",
    solutionText: '1009',
    successMessage: 'Les quatre chiffres s enfoncent. La grille du collecteur se soulève lentement.',
    failMessage: "Le mécanisme reste bloqué. Ce n'est pas un code trouvé ici, c'est l'heure qui poursuit l'histoire.",
    unlockType: 'scene',
    targetSceneId: 'act2_scene_collecteur',
  }, {
    ...makeEnigma(),
    id: 'act2_enig_pression',
    name: 'Pression des vannes',
    question: "Règle la pression avec l'ordre donné par le plan humide: gauche, centre, droite, centre.",
    solutionText: '1323',
    successMessage: 'Les tuyaux cessent de vibrer. La porte technique des sous-sols se déverrouille.',
    failMessage: "La pression remonte brutalement. L'ordre est ailleurs, pas sur ce panneau.",
    unlockType: 'scene',
    targetSceneId: 'act2_scene_sous_sol_technique',
  }, {
    ...makeEnigma(),
    id: 'act2_enig_porte_rouge',
    name: 'Verrou rouge',
    question: "Le verrou rouge exige l'heure morte, mais seulement si le badge est en place.",
    solutionText: '1009',
    successMessage: 'Le verrou reconnaît l’heure. La porte rouge métallique peut être franchie.',
    failMessage: "Le rouge reste éteint. Sans le badge et l'heure, le passage refuse de s'ouvrir.",
    unlockType: 'cinematic',
    targetCinematicId: finalCinematicId,
  });

  draft.scenes.push(
    makeImportedScene({
      id: 'act2_scene_bouche_egout',
      name: "Bouche d'egout sous la cave",
      actId: act2Id,
      introText: "Là descente s'ouvre sous l'endroit sombre de la cave. L'air sent la pierre mouillee et le metal ancien. La montre reste bloquée a 10h09.",
      visualEffect: 'fog',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_grille', name: 'Grille a cadran', x: 52, y: 46, width: 18, height: 16, dialogue: "Le cadran attend l'heure morte.", enigmaId: 'act2_enig_grille_1009', requiredItemId: watchId, lockedMessage: "Sans la montre arrêtée, ce cadran n'a aucun sens." }),
        makeImportedHotspot({ id: 'act2_h_ratsilence', name: 'Rat fige', x: 33, y: 62, width: 14, height: 10, actionType: 'cinematic', dialogue: 'Le rat ne respire même pas.', targetCinematicId: ratCinematicId }),
        makeImportedHotspot({ id: 'act2_h_cléf', name: 'Crochet rouille', x: 72, y: 70, width: 10, height: 10, actionType: 'dialogue_item', dialogue: "Une clé rouillée pend au crochet, comme si quelqu'un venait juste de la poser.", rewardItemId: rustKeyId }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_collecteur',
      name: 'Collecteur principal',
      actId: act2Id,
      introText: "Un long collecteur traverse les égouts. L'eau ne coule presque pas, puis repart par petites secousses quand elle avance.",
      visualEffect: 'rain',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_bouche', name: 'Retour vers la bouche', x: 10, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: "Revenir près de l'ouverture de la cave.", targetSceneId: 'act2_scene_bouche_egout' }),
        makeImportedHotspot({ id: 'act2_h_canal_est', name: 'Canal est', x: 82, y: 55, width: 16, height: 18, actionType: 'scene', dialogue: 'Le canal est descend vers les sous-sols.', targetSceneId: 'act2_scene_canal_est', requiredItemId: rustKeyId, lockedMessage: 'La grille laterale est fermee par une serrure rouillée.' }),
        makeImportedHotspot({ id: 'act2_h_plan', name: 'Plan colle au mur', x: 48, y: 38, width: 16, height: 12, actionType: 'dialogue_item', dialogue: 'Le papier dêtrempe montre un itineraire incomplet: 1-3-2-3.', rewardItemId: mapId }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_canal_est',
      name: 'Canal est des égouts',
      actId: act2Id,
      introText: 'Le canal devient plus bas. Des marques rouges apparaissent sur les tuyaux, mais elles semblent peintes depuis des annees.',
      visualEffect: 'fog',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_collecteur', name: 'Retour collecteur', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Retourner au collecteur.', targetSceneId: 'act2_scene_collecteur' }),
        makeImportedHotspot({ id: 'act2_h_vannes', name: 'Salle dés vannes', x: 78, y: 48, width: 15, height: 18, actionType: 'scene', dialogue: 'Une salle dé vannes coupe le passage.', targetSceneId: 'act2_scene_vannes', requiredItemId: mapId, lockedMessage: 'Sans plan, elle risque de tourner en rond dans les conduites.' }),
        makeImportedHotspot({ id: 'act2_h_ombre', name: "Ombre dans l'eau", x: 46, y: 65, width: 18, height: 10, dialogue: "L'ombre file a contre-courant. Le rat a ouvert quelque chose plus loin." }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_vannes',
      name: 'Salle dés vannes',
      actId: act2Id,
      introText: "Quatre volants de metal bloquént la pression. Un tic-tac se fait entendre, mais aucune horloge ne bouge.",
      visualEffect: 'smoke',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_canal_retour', name: 'Retour canal est', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir au canal est.', targetSceneId: 'act2_scene_canal_est' }),
        makeImportedHotspot({ id: 'act2_h_manivelle', name: 'Manivelle tombee', x: 38, y: 64, width: 12, height: 10, actionType: 'dialogue_item', dialogue: 'Une manivelle froide roule sous la grille.', rewardItemId: valveId }),
        makeImportedHotspot({ id: 'act2_h_pression', name: 'Panneau dé pression', x: 58, y: 42, width: 20, height: 16, dialogue: "Les vannes doivent suivre l'ordre du plan humide.", enigmaId: 'act2_enig_pression', requiredItemId: valveId, lockedMessage: 'Il manque une manivelle pour régler les vannes.' }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_sous_sol_technique',
      name: 'Sous-sol technique',
      actId: act2Id,
      introText: 'Les égouts débouchent sous la maison. Ici, les murs sont en béton, les portes en acier, et chaque lampe tremble à 10h09.',
      visualEffect: 'glow',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_vannes_retour', name: 'Retour salle dés vannes', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Retourner vers les vannes.', targetSceneId: 'act2_scene_vannes' }),
        makeImportedHotspot({ id: 'act2_h_local', name: 'Local électrique', x: 46, y: 50, width: 16, height: 18, actionType: 'scene', dialogue: 'Un local électrique bourdonne derrière une porte basse.', targetSceneId: 'act2_scene_local_electrique' }),
        makeImportedHotspot({ id: 'act2_h_couloir_rouge', name: 'Couloir rouge', x: 82, y: 48, width: 14, height: 18, actionType: 'scene', dialogue: "Un couloir peint de traces rouges s'enfonce plus bas.", targetSceneId: 'act2_scene_couloir_rouge' }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_local_electrique',
      name: 'Local électrique',
      actId: act2Id,
      introText: "Les fusibles sont intacts, mais un voyant rouge pulse comme un cœur. Quelqu'un alimente encore la porte finale.",
      visualEffect: 'glow',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_soussol', name: 'Retour sous-sol', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir au sous-sol technique.', targetSceneId: 'act2_scene_sous_sol_technique' }),
        makeImportedHotspot({ id: 'act2_h_badge_rouge', name: 'Boîtier rouge', x: 54, y: 45, width: 16, height: 16, actionType: 'dialogue_item', dialogue: "Le boîtier s'ouvre avec la clé rouillée. À l'intérieur: un badge rouge métallique.", requiredItemId: rustKeyId, rewardItemId: redBadgeId, lockedMessage: 'Le boîtier est fermé par une serrure rouillée.' }),
        makeImportedHotspot({ id: 'act2_h_note', name: 'Étiquette de maintenance', x: 68, y: 62, width: 14, height: 10, dialogue: "L'étiquette indique: alimentation maintenue tant que l'heure reste 10h09." }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_couloir_rouge',
      name: 'Couloir des sous-sols',
      actId: act2Id,
      introText: "Le couloir est etroit. Les traces rouges ne sont pas du sang: c'est de la peinture industrielle, ecaillee par l'humidite.",
      visualEffect: 'vignette',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_soussol2', name: 'Retour sous-sol', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir au sous-sol technique.', targetSceneId: 'act2_scene_sous_sol_technique' }),
        makeImportedHotspot({ id: 'act2_h_porte_finale', name: 'Porte rouge métallique', x: 78, y: 38, width: 18, height: 34, actionType: 'scene', dialogue: 'La porte rouge attend au bout du couloir.', targetSceneId: 'act2_scene_porte_rouge', requiredItemId: redBadgeId, lockedMessage: 'Le lecteur de la porte reste noir. Il faut le badge rouge.' }),
        makeImportedHotspot({ id: 'act2_h_rat_trace', name: 'Trace du rat', x: 36, y: 66, width: 14, height: 10, dialogue: "Les petites pattes s'arrétént net devant la porte rouge, puis reprennent de l'autre côté." }),
      ],
    }),
    makeImportedScene({
      id: 'act2_scene_porte_rouge',
      name: 'Porte rouge métallique',
      actId: act2Id,
      introText: 'La porte rouge métallique ferme tout le sous-sol. Elle est chaude au toucher. La montre arrêtée vibre enfin dans sa poche.',
      visualEffect: 'glow',
      hotspots: [
        makeImportedHotspot({ id: 'act2_h_retour_couloir', name: 'Retour couloir', x: 8, y: 78, width: 14, height: 12, actionType: 'scene', dialogue: 'Revenir dans le couloir rouge.', targetSceneId: 'act2_scene_couloir_rouge' }),
        makeImportedHotspot({ id: 'act2_h_franchir', name: 'Franchir la porte rouge', x: 50, y: 46, width: 24, height: 36, dialogue: "Le verrou demande l'heure morte: 10h09.", enigmaId: 'act2_enig_porte_rouge', requiredItemId: redBadgeId, lockedMessage: "Le badge rouge doit être prèsente avant d'entrer l'heure." }),
      ],
    }),
  );

  draft.routeMap.rooms.push(
    { id: 'room_act2_scene_bouche_egout', name: "Bouche d'egout sous la cave", sceneId: 'act2_scene_bouche_egout', x: 58, y: 28, type: 'room' },
    { id: 'room_act2_scene_collecteur', name: 'Collecteur principal', sceneId: 'act2_scene_collecteur', x: 70, y: 28, type: 'room' },
    { id: 'room_act2_scene_canal_est', name: 'Canal est des égouts', sceneId: 'act2_scene_canal_est', x: 82, y: 28, type: 'room' },
    { id: 'room_act2_scene_vannes', name: 'Salle dés vannes', sceneId: 'act2_scene_vannes', x: 82, y: 46, type: 'room' },
    { id: 'room_act2_scene_sous_sol_technique', name: 'Sous-sol technique', sceneId: 'act2_scene_sous_sol_technique', x: 70, y: 58, type: 'room' },
    { id: 'room_act2_scene_local_electrique', name: 'Local électrique', sceneId: 'act2_scene_local_electrique', x: 56, y: 58, type: 'room' },
    { id: 'room_act2_scene_couloir_rouge', name: 'Couloir des sous-sols', sceneId: 'act2_scene_couloir_rouge', x: 82, y: 66, type: 'room' },
    { id: 'room_act2_scene_porte_rouge', name: 'Porte rouge métallique', sceneId: 'act2_scene_porte_rouge', x: 92, y: 82, type: 'end' },
  );
  draft.routeMap.connections.push(
    { id: 'connection_act2_01', fromRoomId: 'room_kuvbonw8', toRoomId: 'room_act2_scene_bouche_egout', label: 'Endroit sombre: passage acte II', locked: false, allowOneWay: true },
    { id: 'connection_act2_02', fromRoomId: 'room_act2_scene_bouche_egout', toRoomId: 'room_act2_scene_collecteur', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_03', fromRoomId: 'room_act2_scene_collecteur', toRoomId: 'room_act2_scene_canal_est', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_04', fromRoomId: 'room_act2_scene_canal_est', toRoomId: 'room_act2_scene_vannes', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_05', fromRoomId: 'room_act2_scene_vannes', toRoomId: 'room_act2_scene_sous_sol_technique', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_06', fromRoomId: 'room_act2_scene_sous_sol_technique', toRoomId: 'room_act2_scene_local_electrique', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_07', fromRoomId: 'room_act2_scene_sous_sol_technique', toRoomId: 'room_act2_scene_couloir_rouge', label: '', locked: false, allowOneWay: false },
    { id: 'connection_act2_08', fromRoomId: 'room_act2_scene_couloir_rouge', toRoomId: 'room_act2_scene_porte_rouge', label: '', locked: false, allowOneWay: false },
  );
  draft.routeMap.notes = `${draft.routeMap.notes || ''}\nActe II: commence après l'endroit sombre de la cave, descend dans les égouts puis les sous-sols, et se termine en franchissant la porte rouge métallique. Temps bloqué: 10h09. Rat figé: reprise temporaire du temps.`.trim();
};

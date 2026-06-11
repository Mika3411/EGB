import { useEffect } from 'react';
import { DEFAULT_LANGUAGE } from './translations';

const PHRASES = {
  'Aucun': { en: 'None', es: 'Ninguno', de: 'Keine' },
  'Aucune': { en: 'None', es: 'Ninguna', de: 'Keine' },
  'Aucune scène': { en: 'No scene', es: 'Ninguna escena', de: 'Keine Szene' },
  'Aucune cinématique': { en: 'No cinematic', es: 'Ninguna cinemática', de: 'Kein Cinematic' },
  'Aucune cinématique sélectionnée': { en: 'No cinematic selected', es: 'Ninguna cinemática seleccionada', de: 'Kein Cinematic ausgewählt' },
  'Aucune énigme': { en: 'No puzzle', es: 'Ningún enigma', de: 'Kein Rätsel' },
  'Aucun objet': { en: 'No item', es: 'Ningún objeto', de: 'Kein Gegenstand' },
  'Aucun fond par défaut': { en: 'No default background', es: 'Sin fondo predeterminado', de: 'Kein Standardhintergrund' },
  'Aucun combat simple détecté.': { en: 'No simple combat detected.', es: 'No se detectó ningún combate simple.', de: 'Kein einfacher Kampf erkannt.' },
  'Aucune compétence configurée.': { en: 'No skill configured.', es: 'No hay ninguna habilidad configurada.', de: 'Keine Fähigkeit konfiguriert.' },
  'Aucune conversation à choix multiple': { en: 'No multiple-choice conversation', es: 'Ninguna conversación de opción múltiple', de: 'Keine Multiple-Choice-Unterhaltung' },
  'Aucune condition ajoutée': { en: 'No condition added', es: 'Ninguna condición añadida', de: 'Keine Bedingung hinzugefügt' },
  'Aucune fin accessible avec cet état.': { en: 'No ending is reachable with this state.', es: 'Ningún final es accesible con este estado.', de: 'Mit diesem Zustand ist kein Ende erreichbar.' },
  'Aucune fin configurée.': { en: 'No ending configured.', es: 'No hay ningún final configurado.', de: 'Kein Ende konfiguriert.' },
  'Aucune règle speciale détectée.': { en: 'No special rule detected.', es: 'No se detectó ninguna regla especial.', de: 'Keine Sonderregel erkannt.' },
  'Aucune réponse': { en: 'No reply', es: 'Ninguna respuesta', de: 'Keine Antwort' },
  'Aucune réponse dans cette question.': { en: 'No reply in this question.', es: 'Ninguna respuesta en esta pregunta.', de: 'Keine Antwort in dieser Frage.' },
  'Aucune réponse visible avec cet état.': { en: 'No visible reply with this state.', es: 'Ninguna respuesta visible con este estado.', de: 'Keine sichtbare Antwort mit diesem Zustand.' },
  'Aucune réponse visible dans cette question.': { en: 'No visible reply in this question.', es: 'Ninguna respuesta visible en esta pregunta.', de: 'Keine sichtbare Antwort in dieser Frage.' },
  'Aucun effet joue.': { en: 'No effect played.', es: 'Ningún efecto ejecutado.', de: 'Kein Effekt abgespielt.' },
  'Aucun problème détecté dans les conversations.': { en: 'No issue detected in conversations.', es: 'No se detectó ningún problema en las conversaciones.', de: 'Kein Problem in den Unterhaltungen erkannt.' },
  'Aucun résumé de fin.': { en: 'No ending summary.', es: 'Sin resumen de final.', de: 'Keine Zusammenfassung des Endes.' },
  'Aucun sujet pour le moment': { en: 'No topic for now', es: 'No hay temas por ahora', de: 'Noch kein Thema' },
  'Accueil': { en: 'Home', es: 'Inicio', de: 'Start' },
  'Actualiser': { en: 'Refresh', es: 'Actualizar', de: 'Aktualisieren' },
  'Admin': { en: 'Admin', es: 'Admin', de: 'Admin' },
  'Action': { en: 'Action', es: 'Acción', de: 'Aktion' },
  'Action IA': { en: 'AI action', es: 'Acción IA', de: 'KI-Aktion' },
  'Action du texte': { en: 'Text action', es: 'Acción del texto', de: 'Textaktion' },
  'Action principale': { en: 'Main action', es: 'Acción principal', de: 'Hauptaktion' },
  'Acte': { en: 'Act', es: 'Acto', de: 'Akt' },
  'Actes': { en: 'Acts', es: 'Actos', de: 'Akte' },
  'Afficher': { en: 'Show', es: 'Mostrar', de: 'Anzeigen' },
  'Afficher les contrôles': { en: 'Show controls', es: 'Mostrar controles', de: 'Steuerelemente anzeigen' },
  'Afficher verrouillée dans le player': { en: 'Show as locked in the player', es: 'Mostrar bloqueada en el player', de: 'Im Player gesperrt anzeigen' },
  'Aide': { en: 'Help', es: 'Ayuda', de: 'Hilfe' },
  'Ajoute au moins une bonne fin, une mauvaise fin ou une fin secrète.': { en: 'Add at least one good, bad, or secret ending.', es: 'Añade al menos un final bueno, malo o secreto.', de: 'Füge mindestens ein gutes, schlechtes oder geheimes Ende hinzu.' },
  'Ajoute une autre réponse pour pouvoir la masquer.': { en: 'Add another reply before hiding one.', es: 'Añade otra respuesta para poder ocultarla.', de: 'Füge eine weitere Antwort hinzu, um eine ausblenden zu können.' },
  'Ajoute une cinématique ou sélectionne-en une dans la liste.': {
    en: 'Add a cinematic or select one from the list.',
    es: 'Añade una cinemática o selecciónala en la lista.',
    de: 'Füge ein Cinematic hinzu oder wähle eines aus der Liste.',
  },
  'Ajoute une question pour afficher l\'arbre des choix.': { en: 'Add a question to display the choice tree.', es: 'Añade una pregunta para mostrar el árbol de decisiones.', de: 'Füge eine Frage hinzu, um den Entscheidungsbaum anzuzeigen.' },
  'Ajouter': { en: 'Add', es: 'Añadir', de: 'Hinzufügen' },
  'Ajouter un nombre': { en: 'Add a number', es: 'Añadir un número', de: 'Zahl hinzufügen' },
  'Ajouter un titre de fin': { en: 'Add an ending title', es: 'Añadir un título de final', de: 'Endtitel hinzufügen' },
  'Aller à la réponse': { en: 'Go to reply', es: 'Ir a la respuesta', de: 'Zur Antwort gehen' },
  'Aller à une scène': { en: 'Go to a scene', es: 'Ir a una escena', de: 'Zu einer Szene gehen' },
  'Aller à un acte': { en: 'Go to an act', es: 'Ir a un acto', de: 'Zu einem Akt gehen' },
  'Aller vers...': { en: 'Go to...', es: 'Ir a...', de: 'Gehe zu...' },
  'Ambiance': { en: 'Ambience', es: 'Ambiente', de: 'Atmosphäre' },
  'Ambiance sombre': { en: 'Dark mood', es: 'Ambiente oscuro', de: 'Dunkle Stimmung' },
  'Animation 2D': { en: '2D Animation', es: 'Animación 2D', de: '2D-Animation' },
  'Arène': { en: 'Arena', es: 'Arena', de: 'Arena' },
  'Au moins une condition (OU)': { en: 'At least one condition (OR)', es: 'Al menos una condición (O)', de: 'Mindestens eine Bedingung (ODER)' },
  'Bonnes réponses': { en: 'Correct answers', es: 'Respuestas correctas', de: 'Richtige Antworten' },
  'Boutique': { en: 'Shop', es: 'Tienda', de: 'Shop' },
  'Bonne fin': { en: 'Good ending', es: 'Final bueno', de: 'Gutes Ende' },
  'Mauvaise fin': { en: 'Bad ending', es: 'Final malo', de: 'Schlechtes Ende' },
  'Fin secrète': { en: 'Secret ending', es: 'Final secreto', de: 'Geheimes Ende' },
  'Fin neutre': { en: 'Neutral ending', es: 'Final neutro', de: 'Neutrales Ende' },
  'Branches à corriger': { en: 'Branches to fix', es: 'Ramas por corregir', de: 'Zu korrigierende Zweige' },
  'Branches lisibles d’un coup': { en: 'Branches readable at a glance', es: 'Ramas legibles de un vistazo', de: 'Zweige auf einen Blick lesbar' },
  'Branches visibles': { en: 'Visible branches', es: 'Ramas visibles', de: 'Sichtbare Zweige' },
  'BD / manga': { en: 'Comic / manga', es: 'BD / manga', de: 'Comic / Manga' },
  'Brouillon local restauré.': { en: 'Local draft restored.', es: 'Borrador local restaurado.', de: 'Lokaler Entwurf wiederhergestellt.' },
  'Brouillon remis a zéro.': { en: 'Draft reset.', es: 'Borrador reiniciado.', de: 'Entwurf zurückgesetzt.' },
  'Brouillon restauré.': { en: 'Draft restored.', es: 'Borrador restaurado.', de: 'Entwurf wiederhergestellt.' },
  'Brouillon restauré depuis le projet.': { en: 'Draft restored from the project.', es: 'Borrador restaurado desde el proyecto.', de: 'Entwurf aus dem Projekt wiederhergestellt.' },
  'Cachée si condition fausse': { en: 'Hidden if condition is false', es: 'Oculta si la condición es falsa', de: 'Ausgeblendet, wenn die Bedingung falsch ist' },
  'Catégorie': { en: 'Category', es: 'Categoría', de: 'Kategorie' },
  'Chance': { en: 'Chance', es: 'Probabilidad', de: 'Chance' },
  'Changer de scène': { en: 'Change scene', es: 'Cambiar de escena', de: 'Szene wechseln' },
  'Choisir le modèle visuel': { en: 'Choose the visual model', es: 'Elegir el modelo visual', de: 'Visuelles Modell wählen' },
  'Ce choix pilote le style des prochaines images IA: scènes, objets et cinématiques.': {
    en: 'This choice drives the style of the next AI images: scenes, items and cinematics.',
    es: 'Esta elección guía el estilo de las próximas imágenes IA: escenas, objetos y cinemáticas.',
    de: 'Diese Wahl steuert den Stil der nächsten KI-Bilder: Szenen, Gegenstände und Cinematics.',
  },
  'Ce que tu aimerais pour la suite': {
    en: 'What you would like next',
    es: 'Lo que te gustaría para la continuación',
    de: 'Was du dir für die Fortsetzung wünschst',
  },
  'Choisir une énigme': { en: 'Choose a puzzle', es: 'Elegir un enigma', de: 'Rätsel wählen' },
  'Choisir une réponse': { en: 'Choose a reply', es: 'Elegir una respuesta', de: 'Antwort wählen' },
  'Choisir une scène': { en: 'Choose a scene', es: 'Elegir una escena', de: 'Szene wählen' },
  'Chargement de l\'onglet...': { en: 'Loading tab...', es: 'Cargando pestaña...', de: 'Tab wird geladen...' },
  'Choix': { en: 'Choices', es: 'Opciones', de: 'Auswahl' },
  'Choix faits': { en: 'Choices made', es: 'Opciones tomadas', de: 'Getroffene Entscheidungen' },
  'Choix précédent': { en: 'Previous choice', es: 'Opción anterior', de: 'Vorherige Auswahl' },
  'Choix précédents': { en: 'Previous choices', es: 'Opciones anteriores', de: 'Vorherige Entscheidungen' },
  'Choix, variables et fins': { en: 'Choices, variables and endings', es: 'Opciones, variables y finales', de: 'Entscheidungen, Variablen und Enden' },
  'Chronologie des scènes': { en: 'Scene chronology', es: 'Cronología de escenas', de: 'Szenenchronologie' },
  'Cinématique': { en: 'Cinematic', es: 'Cinemática', de: 'Cinematic' },
  'Cinématique cible': { en: 'Target cinematic', es: 'Cinemática destino', de: 'Ziel-Cinematic' },
  'Cinématique lancée': { en: 'Cinematic launched', es: 'Cinemática lanzada', de: 'Cinematic gestartet' },
  'Cinématiques': { en: 'Cinematics', es: 'Cinemáticas', de: 'Cinematics' },
  'Clignotement': { en: 'Blink', es: 'Parpadeo', de: 'Blinken' },
  'Code demandé au joueur avant d\'ouvrir le projet cible.': { en: 'Code requested from the player before opening the target project.', es: 'Código pedido al jugador antes de abrir el proyecto destino.', de: 'Code, der vor dem Öffnen des Zielprojekts abgefragt wird.' },
  'Combaison': { en: 'Combination', es: 'Combinación', de: 'Kombination' },
  'Combinaison': { en: 'Combination', es: 'Combinación', de: 'Kombination' },
  'Combinaison gagnante': { en: 'Winning combination', es: 'Combinación ganadora', de: 'Gewinnkombination' },
  'Combinaisons': { en: 'Combinations', es: 'Combinaciones', de: 'Kombinationen' },
  'Combat': { en: 'Combat', es: 'Combate', de: 'Kampf' },
  'Combat sélectionné': { en: 'Selected combat', es: 'Combate seleccionado', de: 'Ausgewählter Kampf' },
  'Complet': { en: 'Complete', es: 'Completo', de: 'Vollständig' },
  'Continuer': { en: 'Continue', es: 'Continuar', de: 'Fortsetzen' },
  'Continuer l\'histoire': { en: 'Continue the story', es: 'Continuar la historia', de: 'Die Geschichte fortsetzen' },
  'Compétence': { en: 'Skill', es: 'Habilidad', de: 'Fähigkeit' },
  'Compétences': { en: 'Skills', es: 'Habilidades', de: 'Fähigkeiten' },
  'Compétences du héros': { en: 'Hero skills', es: 'Habilidades del héroe', de: 'Heldenfähigkeiten' },
  'Condition': { en: 'Condition', es: 'Condición', de: 'Bedingung' },
  'Condition objet incomplète': { en: 'Incomplete item condition', es: 'Condición de objeto incompleta', de: 'Unvollständige Gegenstandsbedingung' },
  'Condition scène incomplète': { en: 'Incomplete scene condition', es: 'Condición de escena incompleta', de: 'Unvollständige Szenenbedingung' },
  'Condition variable sans nom': { en: 'Variable condition without a name', es: 'Condición de variable sin nombre', de: 'Variablenbedingung ohne Namen' },
  'Conditions avancées': { en: 'Advanced conditions', es: 'Condiciones avanzadas', de: 'Erweiterte Bedingungen' },
  'Conditions avancées combinées': { en: 'Combined advanced conditions', es: 'Condiciones avanzadas combinadas', de: 'Kombinierte erweiterte Bedingungen' },
  'Contours expressifs, ombres dessinées, tension visuelle stylisée.': {
    en: 'Expressive outlines, drawn shadows, stylized visual tension.',
    es: 'Contornos expresivos, sombras dibujadas, tensión visual estilizada.',
    de: 'Ausdrucksstarke Konturen, gezeichnete Schatten, stilisierte visuelle Spannung.',
  },
  'Continuer la scène': { en: 'Continue the scene', es: 'Continuar la escena', de: 'Szene fortsetzen' },
  'Contrôle et simulation': { en: 'Control and simulation', es: 'Control y simulación', de: 'Kontrolle und Simulation' },
  'Couleur fond': { en: 'Background color', es: 'Color de fondo', de: 'Hintergrundfarbe' },
  'Couleur texte': { en: 'Text color', es: 'Color del texto', de: 'Textfarbe' },
  'Coût mana': { en: 'Mana cost', es: 'Coste de maná', de: 'Manakosten' },
  'Coût annoncé avant lancement': { en: 'Cost announced before launch', es: 'Coste anunciado antes de lanzar', de: 'Vor dem Start angezeigte Kosten' },
  'Créer': { en: 'Create', es: 'Crear', de: 'Erstellen' },
  'Créer un compte': { en: 'Create account', es: 'Crear una cuenta', de: 'Konto erstellen' },
  'Créer la variable': { en: 'Create variable', es: 'Crear variable', de: 'Variable erstellen' },
  'Créer un combat dans Scènes': { en: 'Create a combat in Scenes', es: 'Crear un combate en Escenas', de: 'Kampf in Szenen erstellen' },
  'Créer un jeu complet': { en: 'Create a full game', es: 'Crear un juego completo', de: 'Ein vollständiges Spiel erstellen' },
  'Créer un jeu complet avec scènes, objets et énigmes.': {
    en: 'Create a full game with scenes, items and puzzles.',
    es: 'Crear un juego completo con escenas, objetos y enigmas.',
    de: 'Ein vollständiges Spiel mit Szenen, Gegenständen und Rätseln erstellen.',
  },
  'Crée une nouvelle cinématique. Elle peut servir d’intro, de transition, de révélation ou de récompense après une énigme.': {
    en: 'Creates a new cinematic. It can serve as an intro, transition, reveal or reward after a puzzle.',
    es: 'Crea una nueva cinemática. Puede servir como intro, transición, revelación o recompensa tras un enigma.',
    de: 'Erstellt ein neues Cinematic. Es kann als Intro, Übergang, Enthüllung oder Belohnung nach einem Rätsel dienen.',
  },
  'Crédits IA': { en: 'AI credits', es: 'Créditos IA', de: 'KI-Credits' },
  'Crédits indisponibles (401).': { en: 'Credits unavailable (401).', es: 'Créditos no disponibles (401).', de: 'Credits nicht verfügbar (401).' },
  'Cible victoire': { en: 'Victory target', es: 'Destino victoria', de: 'Ziel bei Sieg' },
  'Cible défaite': { en: 'Defeat target', es: 'Destino derrota', de: 'Ziel bei Niederlage' },
  'Débloqué': { en: 'Unlocked', es: 'Desbloqueado', de: 'Freigeschaltet' },
  'Débloquée': { en: 'Unlocked', es: 'Desbloqueada', de: 'Freigeschaltet' },
  'Débloquée par un choix précédent': { en: 'Unlocked by a previous choice', es: 'Desbloqueada por una opción anterior', de: 'Durch eine vorherige Auswahl freigeschaltet' },
  'Débloquée par un objet / indice': { en: 'Unlocked by an item / clue', es: 'Desbloqueada por un objeto / pista', de: 'Durch Gegenstand / Hinweis freigeschaltet' },
  'Débloquée par une scène visitée': { en: 'Unlocked by a visited scene', es: 'Desbloqueada por una escena visitada', de: 'Durch eine besuchte Szene freigeschaltet' },
  'Débloquée par une variable d\'histoire': { en: 'Unlocked by a story variable', es: 'Desbloqueada por una variable de historia', de: 'Durch eine Story-Variable freigeschaltet' },
  'Débloquée par une zone utilisée': { en: 'Unlocked by a used zone', es: 'Desbloqueada por una zona usada', de: 'Durch eine verwendete Zone freigeschaltet' },
  'Débloquée par une énigme résolue': { en: 'Unlocked by a solved puzzle', es: 'Desbloqueada por un enigma resuelto', de: 'Durch ein gelöstes Rätsel freigeschaltet' },
  'Déclarer': { en: 'Declare', es: 'Declarar', de: 'Deklarieren' },
  'Déclarée': { en: 'Declared', es: 'Declarada', de: 'Deklariert' },
  'Défaut': { en: 'Default', es: 'Predeterminado', de: 'Standard' },
  'Défaut ennemi': { en: 'Default enemy', es: 'Enemigo predeterminado', de: 'Standardgegner' },
  'Défaut héros': { en: 'Default hero', es: 'Héroe predeterminado', de: 'Standardheld' },
  'Définir une valeur': { en: 'Set a value', es: 'Definir un valor', de: 'Wert setzen' },
  'Dégâts': { en: 'Damage', es: 'Daño', de: 'Schaden' },
  'Dégâts moyens cumulés': { en: 'Average cumulative damage', es: 'Daño medio acumulado', de: 'Durchschnittlicher Gesamtschaden' },
  'Départ': { en: 'Start', es: 'Inicio', de: 'Start' },
  'Déplacer': { en: 'Move', es: 'Mover', de: 'Verschieben' },
  'Démo temporaire': { en: 'Temporary demo', es: 'Demo temporal', de: 'Temporäre Demo' },
  'Dupliquer': { en: 'Duplicate', es: 'Duplicar', de: 'Duplizieren' },
  'Détail journal': { en: 'Journal detail', es: 'Detalle del diario', de: 'Journaldetail' },
  'Confidentialité IA': { en: 'AI privacy', es: 'Privacidad IA', de: 'KI-Datenschutz' },
  'Descendre': { en: 'Move down', es: 'Bajar', de: 'Nach unten' },
  'Difficulté': { en: 'Difficulty', es: 'Dificultad', de: 'Schwierigkeit' },
  'Difficile': { en: 'Hard', es: 'Difícil', de: 'Schwer' },
  'Diagnostic': { en: 'Diagnostics', es: 'Diagnóstico', de: 'Diagnose' },
  'Dialogue': { en: 'Dialogue', es: 'Diálogo', de: 'Dialog' },
  'Dialogue au clic': { en: 'Click dialogue', es: 'Diálogo al hacer clic', de: 'Dialog beim Klick' },
  'Edition': { en: 'Editing', es: 'Edición', de: 'Bearbeitung' },
  'Édition': { en: 'Edit', es: 'Edición', de: 'Bearbeiten' },
  'Editeur de scene': { en: 'Scene editor', es: 'Editor de escena', de: 'Szeneneditor' },
  'Durée': { en: 'Duration', es: 'Duración', de: 'Dauer' },
  'Durée (ms)': { en: 'Duration (ms)', es: 'Duración (ms)', de: 'Dauer (ms)' },
  'Durée visée': { en: 'Target duration', es: 'Duración objetivo', de: 'Zieldauer' },
  'Effet cinématique cible manquante': { en: 'Effect target cinematic missing', es: 'Falta la cinemática destino del efecto', de: 'Ziel-Cinematic des Effekts fehlt' },
  'Effet scène cible manquante': { en: 'Effect target scene missing', es: 'Falta la escena destino del efecto', de: 'Zielszene des Effekts fehlt' },
  'Effet variable sans nom': { en: 'Variable effect without a name', es: 'Efecto de variable sin nombre', de: 'Variableneffekt ohne Namen' },
  'Effet énigme cible manquante': { en: 'Effect target puzzle missing', es: 'Falta el enigma destino del efecto', de: 'Zielrätsel des Effekts fehlt' },
  'Effets narratifs': { en: 'Narrative effects', es: 'Efectos narrativos', de: 'Narrative Effekte' },
  'Ennemi commence': { en: 'Enemy starts', es: 'Empieza el enemigo', de: 'Gegner beginnt' },
  'Ennemi par défaut': { en: 'Default enemy', es: 'Enemigo predeterminado', de: 'Standardgegner' },
  'Erreur import vidéo': { en: 'Video import error', es: 'Error al importar vídeo', de: 'Fehler beim Videoimport' },
  'Esquive (%)': { en: 'Dodge (%)', es: 'Esquiva (%)', de: 'Ausweichen (%)' },
  'Édition texte': { en: 'Text editing', es: 'Edición de texto', de: 'Textbearbeitung' },
  'Éditeur de cinématique': { en: 'Cinematic editor', es: 'Editor de cinemáticas', de: 'Cinematic-Editor' },
  'Élément': { en: 'Element', es: 'Elemento', de: 'Element' },
  'Énigme': { en: 'Puzzle', es: 'Enigma', de: 'Rätsel' },
  'Énigme liée': { en: 'Linked puzzle', es: 'Enigma vinculado', de: 'Verknüpftes Rätsel' },
  'Énigme résolue': { en: 'Solved puzzle', es: 'Enigma resuelto', de: 'Gelöstes Rätsel' },
  'Énigmes': { en: 'Puzzles', es: 'Enigmas', de: 'Rätsel' },
  'Enigmes': { en: 'Puzzles', es: 'Enigmas', de: 'Rätsel' },
  'Énigmes résolues': { en: 'Solved puzzles', es: 'Enigmas resueltos', de: 'Gelöste Rätsel' },
  'Équilibrage': { en: 'Balancing', es: 'Equilibrado', de: 'Balancing' },
  'État simule': { en: 'Simulated state', es: 'Estado simulado', de: 'Simulierter Zustand' },
  'Étape 1': { en: 'Step 1', es: 'Paso 1', de: 'Schritt 1' },
  'Étape 2': { en: 'Step 2', es: 'Paso 2', de: 'Schritt 2' },
  'Étape 3': { en: 'Step 3', es: 'Paso 3', de: 'Schritt 3' },
  'Étapes': { en: 'Steps', es: 'Pasos', de: 'Schritte' },
  'État de jeu': { en: 'Game state', es: 'Estado de partida', de: 'Spielzustand' },
  'Expert': { en: 'Expert', es: 'Experto', de: 'Experte' },
  'Fichier vidéo': { en: 'Video file', es: 'Archivo de vídeo', de: 'Videodatei' },
  'Fichier': { en: 'File', es: 'Archivo', de: 'Datei' },
  'Forme': { en: 'Shape', es: 'Forma', de: 'Form' },
  'Facile': { en: 'Easy', es: 'Fácil', de: 'Einfach' },
  'Fin': { en: 'End', es: 'Fin', de: 'Ende' },
  'Fin conversation': { en: 'End conversation', es: 'Fin de conversación', de: 'Unterhaltung beenden' },
  'Fin sans titre': { en: 'Untitled ending', es: 'Final sin título', de: 'Ende ohne Titel' },
  'Fins': { en: 'Endings', es: 'Finales', de: 'Enden' },
  'Fins accessibles': { en: 'Reachable endings', es: 'Finales accesibles', de: 'Erreichbare Enden' },
  'Fond de ce combat': { en: 'This combat background', es: 'Fondo de este combate', de: 'Hintergrund dieses Kampfs' },
  'Fond d\'écran combat': { en: 'Combat background', es: 'Fondo de combate', de: 'Kampfhintergrund' },
  'Fond personnalisé': { en: 'Custom background', es: 'Fondo personalizado', de: 'Eigener Hintergrund' },
  'Force': { en: 'Strength', es: 'Fuerza', de: 'Stärke' },
  'Générer acte par acte': { en: 'Generate act by act', es: 'Generar acto por acto', de: 'Akt für Akt generieren' },
  'Générer acte par acte pour garder le contrôle.': {
    en: 'Generate act by act to stay in control.',
    es: 'Generar acto por acto para mantener el control.',
    de: 'Akt für Akt generieren, um die Kontrolle zu behalten.',
  },
  'Générer le jeu complet': { en: 'Generate the full game', es: 'Generar el juego completo', de: 'Das vollständige Spiel generieren' },
  'Général & structure': { en: 'General & structure', es: 'General y estructura', de: 'Allgemein & Struktur' },
  'Graphe interactif': { en: 'Interactive graph', es: 'Grafo interactivo', de: 'Interaktiver Graph' },
  'Hauteur': { en: 'Height', es: 'Altura', de: 'Höhe' },
  'Héros': { en: 'Hero', es: 'Héroe', de: 'Held' },
  'Héros commence': { en: 'Hero starts', es: 'Empieza el héroe', de: 'Held beginnt' },
  'Héros de ce combat': { en: 'Hero for this combat', es: 'Héroe de este combate', de: 'Held dieses Kampfs' },
  'Héros par défaut': { en: 'Default hero', es: 'Héroe predeterminado', de: 'Standardheld' },
  'IA ennemie': { en: 'Enemy AI', es: 'IA enemiga', de: 'Gegner-KI' },
  'IA ennemie par défaut': { en: 'Default enemy AI', es: 'IA enemiga predeterminada', de: 'Standard-Gegner-KI' },
  'Image après réponse': { en: 'Image after reply', es: 'Imagen tras la respuesta', de: 'Bild nach der Antwort' },
  'Image de la zone': { en: 'Zone image', es: 'Imagen de la zona', de: 'Zonenbild' },
  'Image modifiable': { en: 'Editable image', es: 'Imagen editable', de: 'Bearbeitbares Bild' },
  'Image pop-up': { en: 'Pop-up image', es: 'Imagen pop-up', de: 'Pop-up-Bild' },
  'Image sélectionnée enregistrée.': { en: 'Selected image saved.', es: 'Imagen seleccionada guardada.', de: 'Ausgewähltes Bild gespeichert.' },
  'Image verrouillée': { en: 'Image locked', es: 'Imagen bloqueada', de: 'Bild gesperrt' },
  'Importer 2D Anime': { en: 'Import 2D Anime', es: 'Importar 2D Anime', de: '2D-Anime importieren' },
  'Importer un son unique': { en: 'Import a one-off sound', es: 'Importar un sonido único', de: 'Einmaligen Ton importieren' },
  'Importer une vidéo': { en: 'Import a video', es: 'Importar un vídeo', de: 'Video importieren' },
  'Importer une image': { en: 'Import an image', es: 'Importar una imagen', de: 'Bild importieren' },
  'Importer un JSON': { en: 'Import JSON', es: 'Importar JSON', de: 'JSON importieren' },
  'Import vidéo impossible': { en: 'Video import failed', es: 'No se pudo importar el vídeo', de: 'Videoimport fehlgeschlagen' },
  'Importer JSON': { en: 'Import JSON', es: 'Importar JSON', de: 'JSON importieren' },
  'Interlocuteur': { en: 'Speaker', es: 'Interlocutor', de: 'Sprecher' },
  'Idéal pour un escape game sombre, immersif et proche du cinéma.': {
    en: 'Ideal for a dark, immersive escape game with a cinematic feel.',
    es: 'Ideal para un escape game oscuro, inmersivo y cercano al cine.',
    de: 'Ideal für ein dunkles, immersives Escape Game mit filmischem Gefühl.',
  },
  'Idéal pour une aventure narrative plus graphique et dramatique.': {
    en: 'Ideal for a more graphic and dramatic narrative adventure.',
    es: 'Ideal para una aventura narrativa más gráfica y dramática.',
    de: 'Ideal für ein grafischeres und dramatischeres narratives Abenteuer.',
  },
  'Issues possibles': { en: 'Possible endings', es: 'Finales posibles', de: 'Mögliche Ausgänge' },
  'Intermediaire': { en: 'Intermediate', es: 'Intermedio', de: 'Mittel' },
  'Journal': { en: 'Journal', es: 'Diario', de: 'Journal' },
  'Journal de test': { en: 'Test journal', es: 'Diario de prueba', de: 'Testjournal' },
  'Journal joueur': { en: 'Player journal', es: 'Diario del jugador', de: 'Spielerjournal' },
  'JSON chargé': { en: 'JSON loaded', es: 'JSON cargado', de: 'JSON geladen' },
  'JSON importé': { en: 'Imported JSON', es: 'JSON importado', de: 'Importiertes JSON' },
  'Largeur': { en: 'Width', es: 'Anchura', de: 'Breite' },
  'Lancer une cinématique': { en: 'Launch cinematic', es: 'Lanzar cinemática', de: 'Cinematic starten' },
  'Libellé du bloc': { en: 'Block label', es: 'Etiqueta del bloque', de: 'Blockbeschriftung' },
  'Libre': { en: 'Freeform', es: 'Libre', de: 'Frei' },
  'Lire les réponses cachées, askOnce, conditions, effets et liens entre choix.': { en: 'Read hidden replies, askOnce, conditions, effects and links between choices.', es: 'Leer respuestas ocultas, askOnce, condiciones, efectos y enlaces entre opciones.', de: 'Verborgene Antworten, askOnce, Bedingungen, Effekte und Verknüpfungen zwischen Entscheidungen lesen.' },
  'Lisibilité des images': { en: 'Image readability', es: 'Legibilidad de imágenes', de: 'Bildlesbarkeit' },
  'Lisibilité renforcée': { en: 'Enhanced readability', es: 'Legibilidad reforzada', de: 'Verbesserte Lesbarkeit' },
  'Logique': { en: 'Logic', es: 'Lógica', de: 'Logik' },
  'Médias d\'impact': { en: 'Impact media', es: 'Medios de impacto', de: 'Treffer-Medien' },
  'Message': { en: 'Message', es: 'Mensaje', de: 'Nachricht' },
  'Message après ce choix': { en: 'Message after this choice', es: 'Mensaje tras esta opción', de: 'Nachricht nach dieser Auswahl' },
  'Message d\'échec': { en: 'Failure message', es: 'Mensaje de fallo', de: 'Fehlermeldung' },
  'Message de réussite': { en: 'Success message', es: 'Mensaje de éxito', de: 'Erfolgsmeldung' },
  'Mode 2D Anime actif': { en: '2D Anime mode active', es: 'Modo 2D Anime activo', de: '2D-Anime-Modus aktiv' },
  'Mode Divers': { en: 'Misc mode', es: 'Modo varios', de: 'Sonstiges-Modus' },
  'Mode démo': { en: 'Demo mode', es: 'Modo demo', de: 'Demo-Modus' },
  'Mode IA ennemi par défaut': { en: 'Default enemy AI mode', es: 'Modo de IA enemiga predeterminado', de: 'Standardmodus der Gegner-KI' },
  'Mode missions créateur': { en: 'Creator missions mode', es: 'Modo misiones de creador', de: 'Creator-Missionen-Modus' },
  'Mode vidéo actif': { en: 'Video mode active', es: 'Modo vídeo activo', de: 'Videomodus aktiv' },
  'Modifier': { en: 'Edit', es: 'Modificar', de: 'Bearbeiten' },
  'Modifier la conversation': { en: 'Edit conversation', es: 'Modificar la conversación', de: 'Unterhaltung bearbeiten' },
  'Modifiera :': { en: 'Will modify:', es: 'Modificará:', de: 'Ändert:' },
  'Monter': { en: 'Move up', es: 'Subir', de: 'Nach oben' },
  'Média': { en: 'Media', es: 'Medios', de: 'Medien' },
  'Nom': { en: 'Name', es: 'Nombre', de: 'Name' },
  'Navigation': { en: 'Navigation', es: 'Navegación', de: 'Navigation' },
  'Nom dans le journal': { en: 'Journal name', es: 'Nombre en el diario', de: 'Name im Journal' },
  'Nom de la cinématique': { en: 'Cinematic name', es: 'Nombre de la cinemática', de: 'Name des Cinematics' },
  'Nom de variable': { en: 'Variable name', es: 'Nombre de variable', de: 'Variablenname' },
  'Nom de la scène': { en: 'Scene name', es: 'Nombre de la escena', de: 'Szenenname' },
  'Nom du pouvoir': { en: 'Power name', es: 'Nombre del poder', de: 'Name der Kraft' },
  'Nom du pouvoir par défaut': { en: 'Default power name', es: 'Nombre del poder predeterminado', de: 'Standardname der Kraft' },
  'Nom ennemi': { en: 'Enemy name', es: 'Nombre del enemigo', de: 'Gegnername' },
  'Nom en double': { en: 'Duplicate name', es: 'Nombre duplicado', de: 'Doppelter Name' },
  'Nom statistique': { en: 'Analytics name', es: 'Nombre estadístico', de: 'Statistikname' },
  'Nouveau projet': { en: 'New project', es: 'Nuevo proyecto', de: 'Neues Projekt' },
  'Non déclarée': { en: 'Not declared', es: 'No declarada', de: 'Nicht deklariert' },
  'Note auteur question': { en: 'Question author note', es: 'Nota de autor de la pregunta', de: 'Autorennotiz zur Frage' },
  'Note auteur réponse': { en: 'Reply author note', es: 'Nota de autor de la respuesta', de: 'Autorennotiz zur Antwort' },
  'Objet': { en: 'Item', es: 'Objeto', de: 'Gegenstand' },
  'Objet donné': { en: 'Given item', es: 'Objeto entregado', de: 'Gegebener Gegenstand' },
  'Objet d\'inventaire lié': { en: 'Linked inventory item', es: 'Objeto de inventario vinculado', de: 'Verknüpfter Inventargegenstand' },
  'Objet possède': { en: 'Has item', es: 'Posee objeto', de: 'Besitzt Gegenstand' },
  'Objet requis': { en: 'Required item', es: 'Objeto requerido', de: 'Erforderlicher Gegenstand' },
  'Objets': { en: 'Items', es: 'Objetos', de: 'Gegenstände' },
  'Objets considérés comme déjà possédés par le joueur pendant ce test.': { en: 'Items considered already owned by the player during this test.', es: 'Objetos considerados ya poseídos por el jugador durante esta prueba.', de: 'Gegenstände, die der Spieler in diesem Test bereits besitzt.' },
  'Objets possédés': { en: 'Owned items', es: 'Objetos poseídos', de: 'Besessene Gegenstände' },
  'Outils': { en: 'Tools', es: 'Herramientas', de: 'Werkzeuge' },
  'Options visuelles': { en: 'Visual options', es: 'Opciones visuales', de: 'Visuelle Optionen' },
  'Ouvrir la conversation': { en: 'Open conversation', es: 'Abrir la conversación', de: 'Unterhaltung öffnen' },
  'Ouvrir logique': { en: 'Open logic', es: 'Abrir lógica', de: 'Logik öffnen' },
  'Passer derrière': { en: 'Send backward', es: 'Enviar detrás', de: 'Nach hinten schicken' },
  'Paramètres': { en: 'Settings', es: 'Parámetros', de: 'Einstellungen' },
  'Phrase de début': { en: 'Opening line', es: 'Frase inicial', de: 'Anfangssatz' },
  'Phrase de fin': { en: 'Ending line', es: 'Frase final', de: 'Schlusssatz' },
  'Placeholder': { en: 'Placeholder', es: 'Placeholder', de: 'Platzhalter' },
  'Plan de scène': { en: 'Scene canvas', es: 'Plano de escena', de: 'Szenenplan' },
  'Plein écran': { en: 'Fullscreen', es: 'Pantalla completa', de: 'Vollbild' },
  'Police': { en: 'Font', es: 'Fuente', de: 'Schriftart' },
  'Portrait PNJ': { en: 'NPC portrait', es: 'Retrato PNJ', de: 'NSC-Porträt' },
  'Prévisualiser': { en: 'Preview', es: 'Previsualizar', de: 'Vorschau' },
  'Prochaines étapes': { en: 'Next steps', es: 'Próximos pasos', de: 'Nächste Schritte' },
  'Prochaines réponses visibles': { en: 'Next visible replies', es: 'Próximas respuestas visibles', de: 'Nächste sichtbare Antworten' },
  'Profil': { en: 'Profile', es: 'Perfil', de: 'Profil' },
  'Projet cible': { en: 'Target project', es: 'Proyecto destino', de: 'Zielprojekt' },
  'Projet actuel': { en: 'Current project', es: 'Proyecto actual', de: 'Aktuelles Projekt' },
  'Projet importé': { en: 'Imported project', es: 'Proyecto importado', de: 'Importiertes Projekt' },
  'Projet sélectionné': { en: 'Selected project', es: 'Proyecto seleccionado', de: 'Ausgewähltes Projekt' },
  'Projet temporaire : modifiez, testez, exportez, puis créez un compte pour sauvegarder et publier.': {
    en: 'Temporary project: edit, test, export, then create an account to save and publish.',
    es: 'Proyecto temporal: modifica, prueba, exporta y luego crea una cuenta para guardar y publicar.',
    de: 'Temporäres Projekt: bearbeiten, testen, exportieren und dann ein Konto erstellen, um zu speichern und zu veröffentlichen.',
  },
  'Prolonger le projet actuel ou un JSON importé.': { en: 'Extend the current project or an imported JSON.', es: 'Prolongar el proyecto actual o un JSON importado.', de: 'Das aktuelle Projekt oder importiertes JSON fortsetzen.' },
  'Proposer des idées': { en: 'Suggest ideas', es: 'Proponer ideas', de: 'Ideen vorschlagen' },
  'Progressif': { en: 'Progressive', es: 'Progresivo', de: 'Schrittweise' },
  'PV': { en: 'HP', es: 'PV', de: 'LP' },
  'PV héros pris en compte': { en: 'Hero HP used', es: 'PV del héroe considerados', de: 'Berücksichtigte Helden-LP' },
  'Question': { en: 'Question', es: 'Pregunta', de: 'Frage' },
  'Question / texte du PNJ': { en: 'NPC question / text', es: 'Pregunta / texto del PNJ', de: 'NSC-Frage / Text' },
  'Question courante': { en: 'Current question', es: 'Pregunta actual', de: 'Aktuelle Frage' },
  'Question sans réponse': { en: 'Question without reply', es: 'Pregunta sin respuesta', de: 'Frage ohne Antwort' },
  'Que voulez-vous contrôler ?': { en: 'What do you want to check?', es: '¿Qué quieres controlar?', de: 'Was möchtest du prüfen?' },
  'Quand tu lances une génération IA, les informations nécessaires du projet peuvent être transmises au fournisseur IA: titres, scènes, dialogues, personnages, contraintes et consignes. Les médias volumineux ne sont pas inclus dans ce contexte texte compacté.': {
    en: 'When you launch AI generation, the necessary project information may be sent to the AI provider: titles, scenes, dialogue, characters, constraints and instructions. Large media files are not included in this compact text context.',
    es: 'Cuando lanzas una generación IA, la información necesaria del proyecto puede enviarse al proveedor IA: títulos, escenas, diálogos, personajes, restricciones e instrucciones. Los medios pesados no se incluyen en este contexto de texto compacto.',
    de: 'Wenn du eine KI-Generierung startest, können die nötigen Projektinformationen an den KI-Anbieter gesendet werden: Titel, Szenen, Dialoge, Figuren, Vorgaben und Anweisungen. Große Mediendateien sind in diesem kompakten Textkontext nicht enthalten.',
  },
  'Raison affichée si verrouillée': { en: 'Reason shown when locked', es: 'Razón mostrada si está bloqueada', de: 'Angezeigter Grund bei Sperre' },
  'Raffiner': { en: 'Refine', es: 'Refinar', de: 'Verfeinern' },
  'Raffiner une scène sans remplacer tout le projet.': {
    en: 'Refine a scene without replacing the whole project.',
    es: 'Refinar una escena sin reemplazar todo el proyecto.',
    de: 'Eine Szene verfeinern, ohne das ganze Projekt zu ersetzen.',
  },
  'Recherche globale narrative': { en: 'Global narrative search', es: 'Búsqueda narrativa global', de: 'Globale narrative Suche' },
  'Reconstruire depuis le projet': { en: 'Rebuild from project', es: 'Reconstruir desde el proyecto', de: 'Aus Projekt neu aufbauen' },
  'Refaire le résumé depuis le projet': { en: 'Rebuild summary from project', es: 'Rehacer el resumen desde el proyecto', de: 'Zusammenfassung aus Projekt neu erstellen' },
  'Ressources': { en: 'Resources', es: 'Recursos', de: 'Ressourcen' },
  'Réception du detourage remove.bg...': { en: 'Receiving remove.bg cutout...', es: 'Recibiendo recorte remove.bg...', de: 'remove.bg-Freistellung wird empfangen...' },
  'Réinitialiser la vue': { en: 'Reset view', es: 'Reiniciar vista', de: 'Ansicht zurücksetzen' },
  'Réponse': { en: 'Reply', es: 'Respuesta', de: 'Antwort' },
  'Réponse cachée / débloquée': { en: 'Hidden / unlocked reply', es: 'Respuesta oculta / desbloqueada', de: 'Verborgene / freigeschaltete Antwort' },
  'Réponse de fin': { en: 'Ending reply', es: 'Respuesta de final', de: 'Endantwort' },
  'Réponse du joueur': { en: 'Player reply', es: 'Respuesta del jugador', de: 'Spielerantwort' },
  'Réponse sans effet ni suite': { en: 'Reply without effect or follow-up', es: 'Respuesta sin efecto ni continuación', de: 'Antwort ohne Effekt oder Fortsetzung' },
  'Réponse sans libellé': { en: 'Reply without label', es: 'Respuesta sin etiqueta', de: 'Antwort ohne Beschriftung' },
  'Réponses': { en: 'Replies', es: 'Respuestas', de: 'Antworten' },
  'Réponses et conséquences': { en: 'Replies and consequences', es: 'Respuestas y consecuencias', de: 'Antworten und Folgen' },
  'Réponses visibles': { en: 'Visible replies', es: 'Respuestas visibles', de: 'Sichtbare Antworten' },
  'Résumé de fin': { en: 'Ending summary', es: 'Resumen del final', de: 'Zusammenfassung des Endes' },
  'Résumé de l\'histoire': { en: 'Story summary', es: 'Resumen de la historia', de: 'Zusammenfassung der Geschichte' },
  'Rendu par défaut': { en: 'Default rendering', es: 'Render predeterminado', de: 'Standarddarstellung' },
  'Rendu film, matières naturelles, profondeur et ambiance crédible.': {
    en: 'Film rendering, natural materials, depth and believable mood.',
    es: 'Render cinematográfico, materiales naturales, profundidad y ambiente creíble.',
    de: 'Filmische Darstellung, natürliche Materialien, Tiefe und glaubwürdige Stimmung.',
  },
  'Réaliste': { en: 'Realistic', es: 'Realista', de: 'Realistisch' },
  'Remplacer': { en: 'Replace', es: 'Reemplazar', de: 'Ersetzen' },
  'Respiration': { en: 'Breathing', es: 'Respiración', de: 'Atmung' },
  'Retirer': { en: 'Remove', es: 'Quitar', de: 'Entfernen' },
  'Retirer l\'objet visible après interaction': { en: 'Remove visible object after interaction', es: 'Quitar el objeto visible tras la interacción', de: 'Sichtbares Objekt nach Interaktion entfernen' },
  'Retirer un nombre': { en: 'Subtract a number', es: 'Restar un número', de: 'Zahl abziehen' },
  'Revenir au défaut': { en: 'Back to default', es: 'Volver al predeterminado', de: 'Zurück zum Standard' },
  'Revenir à l original': { en: 'Back to original', es: 'Volver al original', de: 'Zurück zum Original' },
  'Retour à l’accueil': { en: 'Back to home', es: 'Volver al inicio', de: 'Zurück zur Startseite' },
  'Retour': { en: 'Back', es: 'Volver', de: 'Zurück' },
  'Scène': { en: 'Scene', es: 'Escena', de: 'Szene' },
  'Scène à améliorer': { en: 'Scene to improve', es: 'Escena a mejorar', de: 'Zu verbessernde Szene' },
  'Scène animee': { en: 'Animated scene', es: 'Escena animada', de: 'Animierte Szene' },
  'Scène cible': { en: 'Target scene', es: 'Escena destino', de: 'Zielszene' },
  'Scène de départ détectée': { en: 'Detected starting scene', es: 'Escena inicial detectada', de: 'Erkannte Startszene' },
  'Scène de destination': { en: 'Destination scene', es: 'Escena de destino', de: 'Zielszene' },
  'Scène visitée': { en: 'Visited scene', es: 'Escena visitada', de: 'Besuchte Szene' },
  'Scène parente': { en: 'Parent scene', es: 'Escena padre', de: 'Übergeordnete Szene' },
  'Scène principale': { en: 'Main scene', es: 'Escena principal', de: 'Hauptszene' },
  'Scènes visitées': { en: 'Visited scenes', es: 'Escenas visitadas', de: 'Besuchte Szenen' },
  'Scènes': { en: 'Scenes', es: 'Escenas', de: 'Szenen' },
  'Sélectionne un combat pour estimer son équilibre.': { en: 'Select a combat to estimate its balance.', es: 'Selecciona un combate para estimar su equilibrio.', de: 'Wähle einen Kampf, um sein Balancing zu schätzen.' },
  'Sélectionne un combat pour régler son ennemi.': { en: 'Select a combat to configure its enemy.', es: 'Selecciona un combate para configurar su enemigo.', de: 'Wähle einen Kampf, um seinen Gegner einzustellen.' },
  'Sélectionne une image à enregistrer.': { en: 'Select an image to save.', es: 'Selecciona una imagen para guardar.', de: 'Wähle ein Bild zum Speichern aus.' },
  'Sélectionné': { en: 'Selected', es: 'Seleccionado', de: 'Ausgewählt' },
  'Simuler': { en: 'Simulate', es: 'Simular', de: 'Simulieren' },
  'Simuler cette réponse': { en: 'Simulate this reply', es: 'Simular esta respuesta', de: 'Diese Antwort simulieren' },
  'Son après réponse': { en: 'Sound after reply', es: 'Sonido tras la respuesta', de: 'Ton nach Antwort' },
  'Son de l\'animation': { en: 'Animation sound', es: 'Sonido de la animación', de: 'Animationston' },
  'Son de l\'objet': { en: 'Object sound', es: 'Sonido del objeto', de: 'Objektton' },
  'Son de la zone': { en: 'Zone sound', es: 'Sonido de la zona', de: 'Zonenton' },
  'Source': { en: 'Source', es: 'Fuente', de: 'Quelle' },
  'Sous-scenes': { en: 'Sub-scenes', es: 'Subescenas', de: 'Unterszenen' },
  'Structure protégée': { en: 'Protected structure', es: 'Estructura protegida', de: 'Geschützte Struktur' },
  'Suite': { en: 'Continuation', es: 'Continuación', de: 'Fortsetzung' },
  'Suite après cette réponse': { en: 'Follow-up after this reply', es: 'Continuación tras esta respuesta', de: 'Fortsetzung nach dieser Antwort' },
  'Supprimer': { en: 'Delete', es: 'Eliminar', de: 'Löschen' },
  'Supprimer la cinématique': { en: 'Delete cinematic', es: 'Eliminar cinemática', de: 'Cinematic löschen' },
  'Supprimer la zone': { en: 'Delete zone', es: 'Eliminar zona', de: 'Zone löschen' },
  'Supprimer l\'étape': { en: 'Delete step', es: 'Eliminar paso', de: 'Schritt löschen' },
  'Tactique': { en: 'Tactical', es: 'Táctica', de: 'Taktisch' },
  'Tags de branche': { en: 'Branch tags', es: 'Etiquetas de rama', de: 'Zweig-Tags' },
  'Taille de police': { en: 'Font size', es: 'Tamaño de fuente', de: 'Schriftgröße' },
  'Tape un nom de variable, un objet, une fin, une réponse ou un morceau dé texte.': { en: 'Type a variable name, item, ending, reply or text fragment.', es: 'Escribe un nombre de variable, objeto, final, respuesta o fragmento de texto.', de: 'Gib einen Variablennamen, Gegenstand, ein Ende, eine Antwort oder ein Textfragment ein.' },
  'Texte': { en: 'Text', es: 'Texto', de: 'Text' },
  'Theme': { en: 'Theme', es: 'Tema', de: 'Thema' },
  'Ton': { en: 'Tone', es: 'Tono', de: 'Ton' },
  'Texte d’introduction': { en: 'Intro text', es: 'Texto de introducción', de: 'Einführungstext' },
  'Texte du bouton': { en: 'Button text', es: 'Texto del botón', de: 'Buttontext' },
  'Titre de fin': { en: 'Ending title', es: 'Título del final', de: 'Endtitel' },
  'Titre journal': { en: 'Journal title', es: 'Título del diario', de: 'Journaltitel' },
  'Très lumineux': { en: 'Very bright', es: 'Muy luminoso', de: 'Sehr hell' },
  'Type': { en: 'Type', es: 'Tipo', de: 'Typ' },
  'Type de bloc': { en: 'Block type', es: 'Tipo de bloque', de: 'Blocktyp' },
  'Type de cinématique': { en: 'Cinematic type', es: 'Tipo de cinemática', de: 'Cinematic-Typ' },
  'Type de fin': { en: 'Ending type', es: 'Tipo de final', de: 'Endtyp' },
  'Valeur': { en: 'Value', es: 'Valor', de: 'Wert' },
  'Valeur attendue': { en: 'Expected value', es: 'Valor esperado', de: 'Erwarteter Wert' },
  'Valeur de départ': { en: 'Starting value', es: 'Valor inicial', de: 'Startwert' },
  'Utiliser la dernière ligne': { en: 'Use the last line', es: 'Usar la última línea', de: 'Letzte Zeile verwenden' },
  'Variable': { en: 'Variable', es: 'Variable', de: 'Variable' },
  'Variable modifiée': { en: 'Modified variable', es: 'Variable modificada', de: 'Geänderte Variable' },
  'Variable testée mais jamais modifiée': { en: 'Variable tested but never modified', es: 'Variable probada pero nunca modificada', de: 'Variable geprüft, aber nie geändert' },
  'Variable utilisée mais non déclarée': { en: 'Variable used but not declared', es: 'Variable usada pero no declarada', de: 'Variable verwendet, aber nicht deklariert' },
  'Variables': { en: 'Variables', es: 'Variables', de: 'Variablen' },
  'Variables de test': { en: 'Test variables', es: 'Variables de prueba', de: 'Testvariablen' },
  'Variables officielles': { en: 'Official variables', es: 'Variables oficiales', de: 'Offizielle Variablen' },
  'Variables utilisées mais non déclarées': { en: 'Variables used but not declared', es: 'Variables usadas pero no declaradas', de: 'Variablen verwendet, aber nicht deklariert' },
  'Verrouiller': { en: 'Lock', es: 'Bloquear', de: 'Sperren' },
  'Voir le résultat': { en: 'View result', es: 'Ver el resultado', de: 'Ergebnis ansehen' },
  'Bilan': { en: 'Score', es: 'Balance', de: 'Bilanz' },
  'Zone': { en: 'Zone', es: 'Zona', de: 'Zone' },
  'Zone sélectionnée': { en: 'Selected zone', es: 'Zona seleccionada', de: 'Ausgewählte Zone' },
  'Zone déjà utilisée': { en: 'Already used zone', es: 'Zona ya usada', de: 'Bereits verwendete Zone' },
  'Zone utilisée': { en: 'Used zone', es: 'Zona usada', de: 'Verwendete Zone' },
  'Contexte': { en: 'Context', es: 'Contexto', de: 'Kontext' },
  'Masquer': { en: 'Hide', es: 'Ocultar', de: 'Ausblenden' },
  'Mettre devant': { en: 'Bring forward', es: 'Traer delante', de: 'Nach vorne bringen' },
  'Mettre derrière': { en: 'Send backward', es: 'Enviar detrás', de: 'Nach hinten stellen' },
  'Rectangle': { en: 'Rectangle', es: 'Rectángulo', de: 'Rechteck' },
  'Ronde / ovale': { en: 'Round / oval', es: 'Redonda / ovalada', de: 'Rund / oval' },
  'Tester la zone': { en: 'Test zone', es: 'Probar zona', de: 'Zone testen' },
  '+ Journal': { en: '+ Journal', es: '+ Diario', de: '+ Journal' },
  '+ Message': { en: '+ Message', es: '+ Mensaje', de: '+ Nachricht' },
  '+ Objet': { en: '+ Item', es: '+ Objeto', de: '+ Gegenstand' },
  '+ PV': { en: '+ HP', es: '+ PV', de: '+ LP' },
  '+ Réponse': { en: '+ Reply', es: '+ Respuesta', de: '+ Antwort' },
  '+ Variable': { en: '+ Variable', es: '+ Variable', de: '+ Variable' },
  '+ Cinématique': { en: '+ Cinematic', es: '+ Cinemática', de: '+ Cinematic' },
};

const PREFIXES = {
  'Acte ': { en: 'Act ', es: 'Acto ', de: 'Akt ' },
  'Cinématique: ': { en: 'Cinematic: ', es: 'Cinemática: ', de: 'Cinematic: ' },
  'Débloquée si ': { en: 'Unlocked if ', es: 'Desbloqueada si ', de: 'Freigeschaltet wenn ' },
  'Défaut: ': { en: 'Default: ', es: 'Predeterminado: ', de: 'Standard: ' },
  'Donne: ': { en: 'Gives: ', es: 'Da: ', de: 'Gibt: ' },
  'Effet: ': { en: 'Effect: ', es: 'Efecto: ', de: 'Effekt: ' },
  'Énigme: ': { en: 'Puzzle: ', es: 'Enigma: ', de: 'Rätsel: ' },
  'Fin: ': { en: 'Ending: ', es: 'Final: ', de: 'Ende: ' },
  'Journal: ': { en: 'Journal: ', es: 'Diario: ', de: 'Journal: ' },
  'Message: ': { en: 'Message: ', es: 'Mensaje: ', de: 'Nachricht: ' },
  'Objet: ': { en: 'Item: ', es: 'Objeto: ', de: 'Gegenstand: ' },
  'Objet retiré: ': { en: 'Item removed: ', es: 'Objeto retirado: ', de: 'Gegenstand entfernt: ' },
  'Ouvre énigme: ': { en: 'Opens puzzle: ', es: 'Abre enigma: ', de: 'Öffnet Rätsel: ' },
  'Question: ': { en: 'Question: ', es: 'Pregunta: ', de: 'Frage: ' },
  'Scène: ': { en: 'Scene: ', es: 'Escena: ', de: 'Szene: ' },
  'Scène visitée: ': { en: 'Visited scene: ', es: 'Escena visitada: ', de: 'Besuchte Szene: ' },
  'Test: ': { en: 'Check: ', es: 'Prueba: ', de: 'Probe: ' },
  'Va vers scène: ': { en: 'Goes to scene: ', es: 'Va a escena: ', de: 'Geht zu Szene: ' },
  'Variable: ': { en: 'Variable: ', es: 'Variable: ', de: 'Variable: ' },
};

const ATTRIBUTES = ['aria-label', 'data-help', 'placeholder', 'title'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);

const reversePhraseEntries = (() => {
  const entries = [];
  Object.entries(PHRASES).forEach(([source, translations]) => {
    entries.push([source, source]);
    Object.values(translations).forEach((translated) => entries.push([translated, source]));
  });
  return entries.sort((a, b) => b[0].length - a[0].length);
})();

const prefixEntries = (() => {
  const entries = [];
  Object.entries(PREFIXES).forEach(([source, translations]) => {
    entries.push([source, source]);
    Object.values(translations).forEach((translated) => entries.push([translated, source]));
  });
  return entries.sort((a, b) => b[0].length - a[0].length);
})();

const getTargetPhrase = (source, language) => (
  language === DEFAULT_LANGUAGE ? source : PHRASES[source]?.[language] || source
);

const getTargetPrefix = (source, language) => (
  language === DEFAULT_LANGUAGE ? source : PREFIXES[source]?.[language] || source
);

const normalizeKnownPhrase = (value) => {
  const compactValue = String(value || '').replace(/\s+/g, ' ').trim();
  return reversePhraseEntries.find(([candidate]) => candidate === compactValue)?.[1] || '';
};

const splitOuterWhitespace = (value) => {
  const match = String(value ?? '').match(/^(\s*)([\s\S]*?)(\s*)$/);
  return match ? [match[1], match[2], match[3]] : ['', String(value ?? ''), ''];
};

const translateCountPatterns = (language, value) => {
  const countPatterns = [
    {
      source: /^(\d+) question\(s\) - (\d+) réponse\(s\)$/i,
      targets: {
        en: '$1 question(s) - $2 reply/replies',
        es: '$1 pregunta(s) - $2 respuesta(s)',
        de: '$1 Frage(n) - $2 Antwort(en)',
      },
    },
    {
      source: /^(\d+) réponse\(s\)$/i,
      targets: {
        en: '$1 reply/replies',
        es: '$1 respuesta(s)',
        de: '$1 Antwort(en)',
      },
    },
    {
      source: /^(\d+) résultat(s)? trouvé\(s\)$/i,
      targets: {
        en: '$1 result(s) found',
        es: '$1 resultado(s) encontrado(s)',
        de: '$1 Ergebnis(se) gefunden',
      },
    },
    {
      source: /^(\d+) à vérifier$/i,
      targets: {
        en: '$1 to check',
        es: '$1 por revisar',
        de: '$1 zu prüfen',
      },
    },
    {
      source: /^Acte (\d+) généré$/i,
      targets: {
        en: 'Act $1 generated',
        es: 'Acto $1 generado',
        de: 'Akt $1 generiert',
      },
    },
    {
      source: /^Acte (\d+) disponible$/i,
      targets: {
        en: 'Act $1 available',
        es: 'Acto $1 disponible',
        de: 'Akt $1 verfügbar',
      },
    },
  ];

  for (const pattern of countPatterns) {
    const sourceMatch = value.match(pattern.source);
    if (sourceMatch) {
      return language === DEFAULT_LANGUAGE
        ? value
        : value.replace(pattern.source, pattern.targets[language] || value);
    }
    if (language === DEFAULT_LANGUAGE) {
      for (const target of Object.values(pattern.targets)) {
        const targetRegex = new RegExp(`^${target
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\$1/g, '(\\d+)')
          .replace(/\\\$2/g, '(\\d+)')}$`, 'i');
        const targetMatch = value.match(targetRegex);
        if (targetMatch) return value;
      }
    }
  }

  return '';
};

export const translateDeepPanelText = (language, value) => {
  if (!value || typeof value !== 'string') return value;
  const [leading, inner, trailing] = splitOuterWhitespace(value);
  const compactInner = inner.replace(/\s+/g, ' ').trim();
  if (!compactInner) return value;

  const countTranslation = translateCountPatterns(language, compactInner);
  if (countTranslation) return `${leading}${countTranslation}${trailing}`;

  const knownPhrase = normalizeKnownPhrase(compactInner);
  if (knownPhrase) return `${leading}${getTargetPhrase(knownPhrase, language)}${trailing}`;

  const prefixEntry = prefixEntries.find(([prefix]) => compactInner.startsWith(prefix));
  if (prefixEntry) {
    const [, sourcePrefix] = prefixEntry;
    const suffix = compactInner.slice(prefixEntry[0].length);
    return `${leading}${getTargetPrefix(sourcePrefix, language)}${suffix}${trailing}`;
  }

  return value;
};

const translateTextNode = (node, language) => {
  const nextValue = translateDeepPanelText(language, node.nodeValue);
  if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
};

const translateElementAttributes = (element, language) => {
  ATTRIBUTES.forEach((attribute) => {
    const value = element.getAttribute(attribute);
    if (!value) return;
    const translatedValue = translateDeepPanelText(language, value);
    if (translatedValue !== value) element.setAttribute(attribute, translatedValue);
  });
};

const translateTree = (root, language) => {
  if (typeof document === 'undefined' || !root) return;
  const startNode = root.nodeType === Node.ELEMENT_NODE ? root : document.body;
  if (!startNode) return;

  if (startNode.nodeType === Node.ELEMENT_NODE) translateElementAttributes(startNode, language);

  const walker = document.createTreeWalker(
    startNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parentElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (!parentElement || SKIP_TAGS.has(parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let currentNode = walker.currentNode;
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) translateTextNode(currentNode, language);
    if (currentNode.nodeType === Node.ELEMENT_NODE) translateElementAttributes(currentNode, language);
    currentNode = walker.nextNode();
  }
};

export function useDeepPanelDomTranslations(language) {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;

    const applyTranslations = (root = document.body) => {
      window.requestAnimationFrame?.(() => translateTree(root, language));
      if (!window.requestAnimationFrame) translateTree(root, language);
    };

    applyTranslations();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, language);
          return;
        }
        if (mutation.type === 'attributes') {
          translateElementAttributes(mutation.target, language);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
          if (node.nodeType === Node.ELEMENT_NODE) translateTree(node, language);
        });
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ATTRIBUTES,
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language]);
}

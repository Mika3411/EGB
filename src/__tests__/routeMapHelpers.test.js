import { describe, expect, it } from 'vitest';
import {
  ROUTE_CANVAS_ROOM_LIMIT,
  synchronizeRouteMapFromProject,
} from '../domains/scenes/routes/routeMapHelpers.js';

const makeIdFactory = () => {
  const counters = new Map();
  return (prefix) => {
    const nextCount = (counters.get(prefix) || 0) + 1;
    counters.set(prefix, nextCount);
    return `${prefix}_${nextCount}`;
  };
};

const makeScene = (id, overrides = {}) => ({
  id,
  name: overrides.name || id,
  actId: overrides.actId || 'act-1',
  hotspots: overrides.hotspots || [],
  sceneObjects: overrides.sceneObjects || [],
});

const makeProject = (scenes, overrides = {}) => ({
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  start: { type: 'scene', targetSceneId: scenes[0]?.id || '' },
  items: [],
  enigmas: [],
  cinematics: [],
  scenes,
  ...overrides,
});

const getSceneLabelFor = (project) => (sceneId) => (
  project.scenes.find((scene) => scene.id === sceneId)?.name || sceneId
);

const synchronize = (project, routeMap = {}, options = {}) => synchronizeRouteMapFromProject({
  project,
  routeMap,
  actId: 'act-1',
  getSceneLabel: getSceneLabelFor(project),
  idFactory: makeIdFactory(),
  ...options,
});

describe('synchronizeRouteMapFromProject', () => {
  it('adds missing rooms from the current act scenes', () => {
    const project = makeProject([
      makeScene('entry', { name: 'Entrée' }),
      makeScene('library', { name: 'Bibliothèque' }),
    ]);

    const result = synchronize(project);

    expect(result.addedRooms).toBe(2);
    expect(result.routeMap.rooms.map((room) => room.sceneId)).toEqual(['entry', 'library']);
    expect(result.routeMap.rooms.find((room) => room.sceneId === 'entry')?.type).toBe('start');
  });

  it('creates directed connections from extracted project transitions', () => {
    const project = makeProject([
      makeScene('entry', {
        name: 'Entrée',
        hotspots: [{
          id: 'door',
          name: 'Porte',
          actionType: 'scene',
          targetSceneId: 'hall',
        }],
      }),
      makeScene('hall', {
        name: 'Hall',
        hotspots: [{
          id: 'intro',
          name: 'Intro',
          actionType: 'cinematic',
          targetCinematicId: 'cine-hall',
        }],
      }),
      makeScene('vault', {
        name: 'Coffre',
        hotspots: [{
          id: 'puzzle',
          name: 'Puzzle',
          actionType: 'dialogue',
          enigmaId: 'enigma-vault',
        }],
      }),
      makeScene('logic', {
        name: 'Salle logique',
        hotspots: [{
          id: 'lever',
          name: 'Levier',
          actionType: 'dialogue',
          logicRules: [{
            id: 'rule-logic',
            name: 'Cle requise',
            conditionType: 'has_item',
            itemId: 'key',
            actionType: 'scene',
            targetSceneId: 'talk',
          }],
        }],
      }),
      makeScene('talk', {
        name: 'Discussion',
        hotspots: [{
          id: 'dialogue',
          name: 'Dialogue',
          actionType: 'conversation',
          conversation: {
            nodes: [{
              id: 'start',
              speaker: 'Guide',
              text: 'Continuer ?',
              replies: [{
                id: 'reply-end',
                label: 'Accepter',
                actionType: 'cinematic',
                targetCinematicId: 'cine-end',
              }],
            }],
          },
        }],
      }),
      makeScene('end', { name: 'Fin' }),
    ], {
      items: [{ id: 'key', name: 'Cle' }],
      cinematics: [
        { id: 'cine-hall', name: 'Arrivée', onEndType: 'scene', targetSceneId: 'vault' },
        { id: 'cine-end', name: 'Conclusion', onEndType: 'scene', targetSceneId: 'end' },
      ],
      enigmas: [{ id: 'enigma-vault', name: 'Code', unlockType: 'scene', targetSceneId: 'logic' }],
    });

    const result = synchronize(project);
    const roomByScene = new Map(result.routeMap.rooms.map((room) => [room.sceneId, room]));
    const connectionPairs = result.routeMap.connections.map((connection) => {
      const fromSceneId = result.routeMap.rooms.find((room) => room.id === connection.fromRoomId)?.sceneId;
      const toSceneId = result.routeMap.rooms.find((room) => room.id === connection.toRoomId)?.sceneId;
      return `${fromSceneId}->${toSceneId}:${connection.label}`;
    });

    expect(result.addedConnections).toBe(5);
    expect(connectionPairs).toEqual(expect.arrayContaining([
      'entry->hall:Porte',
      'hall->vault:Intro',
      'vault->logic:Puzzle',
      'logic->talk:Levier · Cle requise',
      'talk->end:Dialogue · Accepter',
    ]));
    expect(roomByScene.get('end')?.type).toBe('end');
  });

  it('preserves existing room positions and canvas assignments', () => {
    const project = makeProject([
      makeScene('entry', { name: 'Entrée' }),
      makeScene('library', { name: 'Bibliothèque' }),
    ]);
    const existingRouteMap = {
      rooms: [{
        id: 'manual-entry',
        name: 'Entrée placée',
        sceneId: 'entry',
        canvasId: 'canvas-manual',
        x: 42,
        y: 37,
        type: 'start',
      }],
      connections: [],
      canvases: [{ id: 'canvas-manual', name: 'Canvas manuel' }],
    };

    const result = synchronize(project, existingRouteMap);
    const existingRoom = result.routeMap.rooms.find((room) => room.id === 'manual-entry');

    expect(result.addedRooms).toBe(1);
    expect(existingRoom).toMatchObject({
      sceneId: 'entry',
      canvasId: 'canvas-manual',
      x: 42,
      y: 37,
      type: 'start',
    });
  });

  it('does not duplicate generated connections when synchronized again', () => {
    const project = makeProject([
      makeScene('entry', {
        hotspots: [{
          id: 'door',
          name: 'Porte',
          actionType: 'scene',
          targetSceneId: 'hall',
        }],
      }),
      makeScene('hall'),
    ]);

    const firstResult = synchronize(project);
    const secondResult = synchronize(project, firstResult.routeMap);

    expect(firstResult.routeMap.connections).toHaveLength(1);
    expect(secondResult.addedConnections).toBe(0);
    expect(secondResult.routeMap.connections).toHaveLength(1);

    const dedupedResult = synchronize(project, {
      rooms: [
        { id: 'room-entry', sceneId: 'entry', type: 'start' },
        { id: 'room-hall', sceneId: 'hall', type: 'room' },
      ],
      connections: [
        {
          id: 'auto-1',
          fromRoomId: 'room-entry',
          toRoomId: 'room-hall',
          label: 'Porte',
          condition: '',
          locked: false,
          allowOneWay: true,
          autoGenerated: true,
        },
        {
          id: 'auto-2',
          fromRoomId: 'room-entry',
          toRoomId: 'room-hall',
          label: 'Porte',
          condition: '',
          locked: false,
          allowOneWay: true,
          autoGenerated: true,
        },
      ],
      canvases: [{ id: 'route_canvas_1', name: 'Canvas 1' }],
    });

    expect(dedupedResult.addedConnections).toBe(0);
    expect(dedupedResult.routeMap.connections).toHaveLength(1);
    expect(dedupedResult.routeMap.connections[0].id).toBe('auto-1');
  });

  it('marks conditional one-way transitions as locked and allowOneWay', () => {
    const project = makeProject([
      makeScene('entry', {
        hotspots: [{
          id: 'locked-door',
          name: 'Porte verrouillée',
          actionType: 'scene',
          targetSceneId: 'vault',
          requiredItemId: 'key',
        }],
      }),
      makeScene('vault'),
    ], {
      items: [{ id: 'key', name: 'Cle' }],
    });

    const result = synchronize(project);
    const connection = result.routeMap.connections[0];

    expect(result.lockedConnections).toBe(1);
    expect(connection.locked).toBe(true);
    expect(connection.allowOneWay).toBe(true);
    expect(connection.condition).toBe('Objet requis: Cle');
  });

  it('spreads new rooms across canvases without exceeding the canvas room limit', () => {
    const scenes = Array.from({ length: ROUTE_CANVAS_ROOM_LIMIT + 3 }, (_, index) => (
      makeScene(`scene-${index}`, { name: `Scene ${index}` })
    ));
    const project = makeProject(scenes);

    const result = synchronize(project);
    const roomsByCanvas = result.routeMap.rooms.reduce((groups, room) => {
      groups.set(room.canvasId, (groups.get(room.canvasId) || 0) + 1);
      return groups;
    }, new Map());

    expect(result.addedRooms).toBe(ROUTE_CANVAS_ROOM_LIMIT + 3);
    expect(result.routeMap.canvases.length).toBeGreaterThan(1);
    expect([...roomsByCanvas.values()].every((count) => count <= ROUTE_CANVAS_ROOM_LIMIT)).toBe(true);
  });
});

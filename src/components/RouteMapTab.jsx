import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, DoorOpen, Link, MapPin, Plus, Trash2, XCircle } from 'lucide-react';

const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const getDefaultMap = () => ({ rows: 16, cols: 24, cells: [], rooms: [], connections: [], notes: '' });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const roomLabel = (room, project, getSceneLabel) => {
  if (room.sceneId) return getSceneLabel(room.sceneId);
  return room.name || 'Pièce sans nom';
};

const getActStartSceneId = (project, actId) => {
  const actScenes = (project.scenes || []).filter((scene) => scene.actId === actId);
  return actScenes.find((scene) => !scene.parentSceneId)?.id || actScenes[0]?.id || '';
};

const getCinematicTargetSceneIds = (project, cinematicId) => {
  const cinematic = (project.cinematics || []).find((entry) => entry.id === cinematicId);
  if (!cinematic) return [];
  if (cinematic.onEndType === 'scene' && cinematic.targetSceneId) return [cinematic.targetSceneId];
  if (cinematic.onEndType === 'act' && cinematic.targetActId) {
    const targetSceneId = getActStartSceneId(project, cinematic.targetActId);
    return targetSceneId ? [targetSceneId] : [];
  }
  return [];
};

const getEnigmaTargetSceneIds = (project, enigmaId) => {
  const enigma = (project.enigmas || []).find((entry) => entry.id === enigmaId);
  if (!enigma) return [];
  if (enigma.unlockType === 'scene' && enigma.targetSceneId) return [enigma.targetSceneId];
  if (enigma.unlockType === 'cinematic' && enigma.targetCinematicId) {
    return getCinematicTargetSceneIds(project, enigma.targetCinematicId);
  }
  return [];
};

const getActionTargetSceneIds = (project, action) => {
  if (!action) return [];
  if (action.enigmaId) {
    const enigmaTargets = getEnigmaTargetSceneIds(project, action.enigmaId);
    if (enigmaTargets.length) return enigmaTargets;
  }
  if (action.actionType === 'scene' && action.targetSceneId) return [action.targetSceneId];
  if (action.actionType === 'cinematic' && action.targetCinematicId) {
    return getCinematicTargetSceneIds(project, action.targetCinematicId);
  }
  return [];
};

const getSceneTransitions = (project) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || []).flatMap((hotspot) => {
      const actions = [
        {
          label: hotspot.name || 'Zone',
          actionType: hotspot.actionType,
          targetSceneId: hotspot.targetSceneId,
          targetCinematicId: hotspot.targetCinematicId,
          enigmaId: hotspot.enigmaId,
        },
        hotspot.hasSecondAction ? {
          label: `${hotspot.name || 'Zone'} (2e action)`,
          actionType: hotspot.secondActionType,
          targetSceneId: hotspot.secondTargetSceneId,
          targetCinematicId: hotspot.secondTargetCinematicId,
          enigmaId: hotspot.secondEnigmaId,
        } : null,
        ...(hotspot.logicRules || []).map((rule) => (
          rule.actionType === 'default'
            ? {
              label: `${hotspot.name || 'Zone'} · ${rule.name || 'Règle'}`,
              actionType: hotspot.actionType,
              targetSceneId: hotspot.targetSceneId,
              targetCinematicId: hotspot.targetCinematicId,
              enigmaId: hotspot.enigmaId,
            }
            : {
              label: `${hotspot.name || 'Zone'} · ${rule.name || 'Règle'}`,
              actionType: rule.actionType,
              targetSceneId: rule.targetSceneId,
              targetCinematicId: rule.targetCinematicId,
              enigmaId: rule.enigmaId,
            }
        )),
      ].filter(Boolean);

      return actions.flatMap((action) => (
        getActionTargetSceneIds(project, action)
          .filter((targetSceneId) => targetSceneId && targetSceneId !== scene.id)
          .map((targetSceneId) => ({
            fromSceneId: scene.id,
            toSceneId: targetSceneId,
            label: action.label,
          }))
      ));
    })
  ))
);

const scenePairKey = (sceneA = '', sceneB = '') => [sceneA, sceneB].sort().join('<>');

const pushUnique = (messages, message) => {
  if (!messages.includes(message)) messages.push(message);
};

const getConnectionActionStatus = (project, rooms, connection, getSceneLabel) => {
  const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
  const toRoom = rooms.find((room) => room.id === connection.toRoomId);
  if (!fromRoom || !toRoom) return null;
  if (!fromRoom.sceneId || !toRoom.sceneId) {
    return {
      connectionId: connection.id,
      status: 'neutral',
      message: 'Lie les deux pièces à des scènes pour vérifier les zones d’action.',
    };
  }

  const transitions = getSceneTransitions(project);
  const forwardExists = transitions.some((transition) => (
    transition.fromSceneId === fromRoom.sceneId && transition.toSceneId === toRoom.sceneId
  ));
  const reverseExists = transitions.some((transition) => (
    transition.fromSceneId === toRoom.sceneId && transition.toSceneId === fromRoom.sceneId
  ));
  const fromLabel = roomLabel(fromRoom, project, getSceneLabel);
  const toLabel = roomLabel(toRoom, project, getSceneLabel);

  if (forwardExists && reverseExists) {
    return {
      connectionId: connection.id,
      status: 'ok',
      message: `${fromLabel} ↔ ${toLabel}: zones d’action dans les deux sens.`,
    };
  }

  if (forwardExists || reverseExists) {
    return {
      connectionId: connection.id,
      status: 'partial',
      message: forwardExists
        ? `${fromLabel} → ${toLabel} existe, mais il manque ${toLabel} → ${fromLabel}.`
        : `${toLabel} → ${fromLabel} existe, mais il manque ${fromLabel} → ${toLabel}.`,
    };
  }

  return {
    connectionId: connection.id,
    status: 'missing',
    message: `${fromLabel} ↔ ${toLabel}: aucune zone d’action ne relie ces deux pièces.`,
  };
};

const buildDiagnostics = (project, routeMap, getSceneLabel) => {
  const rooms = routeMap.rooms || [];
  const roomIds = new Set(rooms.map((room) => room.id));
  const connections = (routeMap.connections || []).filter((connection) => (
    roomIds.has(connection.fromRoomId) && roomIds.has(connection.toRoomId)
  ));
  const problems = [];
  const warnings = [];
  const connectionChecks = connections
    .map((connection) => getConnectionActionStatus(project, rooms, connection, getSceneLabel))
    .filter(Boolean);

  if (!rooms.length) problems.push('Aucune pièce créée dans le plan.');

  const starts = rooms.filter((room) => room.type === 'start');
  const ends = rooms.filter((room) => room.type === 'end');
  if (starts.length !== 1) problems.push(starts.length ? 'Le plan doit avoir un seul départ.' : 'Ajoute une pièce de départ.');
  if (ends.length !== 1) warnings.push(ends.length ? 'Le plan a plusieurs arrivées.' : 'Ajoute une arrivée si le parcours a une fin prévue.');

  rooms.forEach((room) => {
    const degree = connections.filter((connection) => (
      connection.fromRoomId === room.id || connection.toRoomId === room.id
    )).length;
    if (!degree && rooms.length > 1) problems.push(`${roomLabel(room, project, getSceneLabel)} n’est reliée à aucune autre pièce.`);
  });

  if (starts.length === 1) {
    const visited = new Set([starts[0].id]);
    const queue = [starts[0].id];
    while (queue.length) {
      const currentId = queue.shift();
      connections.forEach((connection) => {
        const nextRoomId = connection.fromRoomId === currentId ? connection.toRoomId : connection.toRoomId === currentId ? connection.fromRoomId : '';
        if (!nextRoomId || visited.has(nextRoomId)) return;
        visited.add(nextRoomId);
        queue.push(nextRoomId);
      });
    }
    rooms.forEach((room) => {
      if (!visited.has(room.id)) problems.push(`${roomLabel(room, project, getSceneLabel)} est inaccessible depuis le départ.`);
    });
  }

  const roomsByScene = new Map(rooms.filter((room) => room.sceneId).map((room) => [room.sceneId, room]));
  const mapScenePairs = new Set(connections.map((connection) => {
    const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
    const toRoom = rooms.find((room) => room.id === connection.toRoomId);
    if (!fromRoom?.sceneId || !toRoom?.sceneId) return '';
    return scenePairKey(fromRoom.sceneId, toRoom.sceneId);
  }).filter(Boolean));
  const sceneTransitions = getSceneTransitions(project);

  sceneTransitions.forEach((transition) => {
    if (!roomsByScene.has(transition.fromSceneId) || !roomsByScene.has(transition.toSceneId)) return;
    if (!mapScenePairs.has(scenePairKey(transition.fromSceneId, transition.toSceneId))) {
      pushUnique(warnings, `Une transition du jeu relie ${getSceneLabel(transition.fromSceneId)} et ${getSceneLabel(transition.toSceneId)}, mais cette liaison manque sur le plan.`);
    }
  });

  connectionChecks.forEach((check) => {
    const connection = connections.find((entry) => entry.id === check.connectionId);
    if (check.status === 'missing') pushUnique(problems, check.message);
    if (check.status === 'partial' && !connection?.allowOneWay) pushUnique(warnings, check.message);
  });

  return {
    problems,
    warnings,
    connectionChecks,
    ok: problems.length === 0,
  };
};

export default function RouteMapTab({ project, patchProject, getSceneLabel }) {
  const routeMap = project.routeMap || getDefaultMap();
  const [selectedRoomId, setSelectedRoomId] = useState(routeMap.rooms?.[0]?.id || '');
  const [connectFromId, setConnectFromId] = useState('');
  const [draggingRoomId, setDraggingRoomId] = useState('');

  const rooms = routeMap.rooms || [];
  const connections = routeMap.connections || [];
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;
  const diagnostics = useMemo(() => buildDiagnostics(project, routeMap, getSceneLabel), [project, routeMap, getSceneLabel]);
  const connectionChecksById = useMemo(() => (
    new Map((diagnostics.connectionChecks || []).map((check) => [check.connectionId, check]))
  ), [diagnostics.connectionChecks]);

  const patchRouteMap = (updater, options) => {
    patchProject((draft) => {
      if (!draft.routeMap) draft.routeMap = getDefaultMap();
      if (!Array.isArray(draft.routeMap.rooms)) draft.routeMap.rooms = [];
      if (!Array.isArray(draft.routeMap.connections)) draft.routeMap.connections = [];
      updater(draft.routeMap);
    }, options);
  };

  const addRoom = (sceneId = '') => {
    const room = {
      id: makeId('room'),
      name: sceneId ? getSceneLabel(sceneId) : `Pièce ${rooms.length + 1}`,
      sceneId,
      x: clamp(18 + rooms.length * 9, 8, 86),
      y: clamp(20 + rooms.length * 7, 10, 84),
      type: rooms.some((entry) => entry.type === 'start') ? 'room' : 'start',
    };
    patchRouteMap((draftMap) => {
      draftMap.rooms.push(room);
    });
    setSelectedRoomId(room.id);
  };

  const addMissingSceneRooms = () => {
    const mappedSceneIds = new Set(rooms.map((room) => room.sceneId).filter(Boolean));
    const scenesToAdd = (project.scenes || []).filter((scene) => !mappedSceneIds.has(scene.id));
    patchRouteMap((draftMap) => {
      scenesToAdd.forEach((scene, index) => {
        draftMap.rooms.push({
          id: makeId('room'),
          name: scene.name || `Pièce ${draftMap.rooms.length + 1}`,
          sceneId: scene.id,
          x: clamp(16 + (index % 5) * 16, 8, 90),
          y: clamp(18 + Math.floor(index / 5) * 18, 10, 86),
          type: draftMap.rooms.some((room) => room.type === 'start') ? 'room' : 'start',
        });
      });
    });
  };

  const updateRoom = (roomId, updater, options) => {
    patchRouteMap((draftMap) => {
      const room = draftMap.rooms.find((entry) => entry.id === roomId);
      if (room) updater(room, draftMap);
    }, options);
  };

  const deleteRoom = (roomId) => {
    const room = routeMap.rooms.find((entry) => entry.id === roomId);
    if (!window.confirm(`Supprimer la pièce "${room?.name || 'sélectionnée'}" et ses liaisons ?`)) return;
    patchRouteMap((draftMap) => {
      draftMap.rooms = draftMap.rooms.filter((room) => room.id !== roomId);
      draftMap.connections = draftMap.connections.filter((connection) => (
        connection.fromRoomId !== roomId && connection.toRoomId !== roomId
      ));
    });
    setSelectedRoomId('');
    setConnectFromId('');
  };

  const deleteConnection = (connectionId) => {
    if (!window.confirm('Supprimer cette liaison ?')) return;
    patchRouteMap((draftMap) => {
      draftMap.connections = draftMap.connections.filter((connection) => connection.id !== connectionId);
    });
  };

  const toggleConnectionOneWayApproval = (connectionId) => {
    patchRouteMap((draftMap) => {
      const connection = draftMap.connections.find((entry) => entry.id === connectionId);
      if (connection) connection.allowOneWay = !connection.allowOneWay;
    });
  };

  const toggleConnection = (toRoomId) => {
    if (!connectFromId) {
      setConnectFromId(toRoomId);
      setSelectedRoomId(toRoomId);
      return;
    }
    if (connectFromId === toRoomId) {
      setConnectFromId('');
      return;
    }
    patchRouteMap((draftMap) => {
      const existing = draftMap.connections.find((connection) => (
        connection.fromRoomId === connectFromId && connection.toRoomId === toRoomId
      ));
      if (existing) {
        draftMap.connections = draftMap.connections.filter((connection) => connection.id !== existing.id);
      } else {
        draftMap.connections.push({
          id: makeId('connection'),
          fromRoomId: connectFromId,
          toRoomId,
          label: '',
          locked: false,
          allowOneWay: false,
        });
      }
    });
    setConnectFromId('');
    setSelectedRoomId(toRoomId);
  };

  const clearMap = () => {
    if (!window.confirm('Effacer tout le plan de route ?')) return;
    patchRouteMap((draftMap) => {
      draftMap.rooms = [];
      draftMap.connections = [];
    });
    setSelectedRoomId('');
    setConnectFromId('');
  };

  const handleRoomPointerMove = (event, roomId) => {
    if (draggingRoomId !== roomId) return;
    const board = event.currentTarget.closest('.route-room-board');
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 5, 95);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 7, 93);
    updateRoom(roomId, (room) => {
      room.x = x;
      room.y = y;
    }, { rememberHistory: false });
  };

  return (
    <div className="layout route-map-layout">
      <section className="panel side route-map-tools">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Plan</span>
            <h2>Pièces</h2>
          </div>
          <span className={`status-badge ${diagnostics.ok ? '' : 'soft'}`}>{diagnostics.ok ? 'OK' : `${diagnostics.problems.length} souci(s)`}</span>
        </div>

        <div className="inline-actions" data-tour="map-add-room">
          <button type="button" onClick={() => addRoom()}>
            <Plus size={16} aria-hidden="true" />
            Pièce
          </button>
          <button type="button" className="secondary-action" onClick={addMissingSceneRooms}>
            <DoorOpen size={16} aria-hidden="true" />
            Depuis scènes
          </button>
        </div>

        <p className="small-note">Clique une pièce, puis “Relier”, puis une autre pièce pour créer ou retirer une connexion orientée.</p>

        <div className="route-room-list">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`list-card ${selectedRoomId === room.id ? 'selected' : ''}`}
              onClick={() => setSelectedRoomId(room.id)}
            >
              <strong>{room.name || 'Pièce'}</strong>
              <span>{room.sceneId ? getSceneLabel(room.sceneId) : 'Aucune scène liée'}</span>
            </button>
          ))}
          {!rooms.length ? <div className="empty-state-inline">Ajoute les pièces du parcours.</div> : null}
        </div>

        <label>
          Notes de parcours
          <textarea
            value={routeMap.notes || ''}
            placeholder="Conditions d’accès, ordre prévu, pièges de connexion..."
            onChange={(event) => patchRouteMap((draftMap) => {
              draftMap.notes = event.target.value;
            })}
          />
        </label>

        <button type="button" className="danger-button route-map-clear" onClick={clearMap}>
          <Trash2 size={16} aria-hidden="true" />
          Effacer le plan
        </button>
      </section>

      <section className="panel main route-map-main">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Connexions</span>
            <h2>Carte des pièces</h2>
          </div>
          <span className="small-note">{connections.length} liaison{connections.length > 1 ? 's' : ''}</span>
        </div>

        <div className="route-room-board" data-tour="map-board">
          <svg className="route-connection-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="route-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(191, 219, 254, .82)" />
              </marker>
              <marker id="route-arrow-missing" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
              </marker>
              <marker id="route-arrow-partial" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
              </marker>
              <marker id="route-arrow-ok" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#22c55e" />
              </marker>
            </defs>
            {connections.map((connection) => {
              const fromRoom = rooms.find((room) => room.id === connection.fromRoomId);
              const toRoom = rooms.find((room) => room.id === connection.toRoomId);
              if (!fromRoom || !toRoom) return null;
              const check = connectionChecksById.get(connection.id);
              const status = check?.status || 'neutral';
              const markerId = ['missing', 'partial', 'ok'].includes(status) ? `route-arrow-${status}` : 'route-arrow';
              return (
                <line
                  key={connection.id}
                  x1={fromRoom.x}
                  y1={fromRoom.y}
                  x2={toRoom.x}
                  y2={toRoom.y}
                  className={`status-${status} ${connection.locked ? 'locked' : ''}`}
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </svg>

          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`route-room-node type-${room.type || 'room'} ${selectedRoomId === room.id ? 'selected' : ''} ${connectFromId === room.id ? 'connecting' : ''}`}
              style={{ left: `${room.x}%`, top: `${room.y}%` }}
              onClick={() => {
                if (connectFromId) toggleConnection(room.id);
                else setSelectedRoomId(room.id);
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setDraggingRoomId(room.id);
                setSelectedRoomId(room.id);
              }}
              onPointerMove={(event) => handleRoomPointerMove(event, room.id)}
              onPointerUp={() => setDraggingRoomId('')}
            >
              <MapPin size={15} aria-hidden="true" />
              <span>{room.name || 'Pièce'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel side route-map-inspector">
        <div className="panel-head">
          <h2>Détail</h2>
        </div>

        {selectedRoom ? (
          <div className="editor-stack" data-tour="map-room-detail">
            <label>
              Nom de la pièce
              <input value={selectedRoom.name || ''} onChange={(event) => updateRoom(selectedRoom.id, (room) => {
                room.name = event.target.value;
              })} />
            </label>
            <label>
              Scène liée
              <select value={selectedRoom.sceneId || ''} onChange={(event) => updateRoom(selectedRoom.id, (room) => {
                room.sceneId = event.target.value;
              })}>
                <option value="">Aucune scène</option>
                {(project.scenes || []).map((scene) => (
                  <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
                ))}
              </select>
            </label>
            <label>
              Rôle dans le parcours
              <select value={selectedRoom.type || 'room'} onChange={(event) => updateRoom(selectedRoom.id, (room, draftMap) => {
                if (event.target.value === 'start') {
                  draftMap.rooms.forEach((entry) => {
                    if (entry.id !== room.id && entry.type === 'start') entry.type = 'room';
                  });
                }
                room.type = event.target.value;
              })}>
                <option value="room">Pièce normale</option>
                <option value="start">Départ</option>
                <option value="end">Arrivée</option>
              </select>
            </label>

            <div className="inline-actions">
              <button type="button" className={connectFromId === selectedRoom.id ? 'ghost-action' : ''} onClick={() => toggleConnection(selectedRoom.id)}>
                <Link size={16} aria-hidden="true" />
                {connectFromId === selectedRoom.id ? 'Choisis la cible' : 'Relier'}
              </button>
              <button type="button" className="danger-button" onClick={() => deleteRoom(selectedRoom.id)}>
                <Trash2 size={16} aria-hidden="true" />
                Supprimer
              </button>
            </div>

            <div className="route-connection-list">
              <strong>Liaisons</strong>
              {connections.filter((connection) => (
                connection.fromRoomId === selectedRoom.id || connection.toRoomId === selectedRoom.id
              )).map((connection) => {
                const otherRoomId = connection.fromRoomId === selectedRoom.id ? connection.toRoomId : connection.fromRoomId;
                const target = rooms.find((room) => room.id === otherRoomId);
                const check = connectionChecksById.get(connection.id);
                const isAcceptedOneWay = check?.status === 'partial' && connection.allowOneWay;
                return (
                  <span key={connection.id} className={`route-connection-status status-${check?.status || 'neutral'} ${isAcceptedOneWay ? 'accepted' : ''}`}>
                    <span>{connection.fromRoomId === selectedRoom.id ? '→' : '←'} {target ? roomLabel(target, project, getSceneLabel) : 'Pièce supprimée'}</span>
                    {check?.status === 'partial' ? (
                      <button
                        type="button"
                        className={`route-approve-connection ${connection.allowOneWay ? 'active' : ''}`}
                        onClick={() => toggleConnectionOneWayApproval(connection.id)}
                        title={connection.allowOneWay ? 'Remettre en avertissement' : 'Valider cet aller simple'}
                      >
                        {connection.allowOneWay ? 'Validé' : 'Valider'}
                      </button>
                    ) : null}
                    <button type="button" className="danger-button route-delete-connection" onClick={() => deleteConnection(connection.id)} title="Supprimer cette liaison">
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
              {!connections.some((connection) => connection.fromRoomId === selectedRoom.id || connection.toRoomId === selectedRoom.id) ? (
                <span>Aucune liaison pour cette pièce.</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="empty-state-inline">Sélectionne une pièce pour la nommer, la lier à une scène ou créer une connexion.</div>
        )}

        <div className="divider-line" />
        <div className="route-diagnostics" data-tour="map-diagnostics">
          <div className="panel-head">
            <h2>Vérification</h2>
          </div>
          <div className="route-legend">
            <span className="status-missing">Aucune zone</span>
            <span className="status-partial">Un seul sens</span>
            <span className="status-ok">Aller-retour</span>
          </div>
          {diagnostics.problems.length || diagnostics.warnings.length ? (
            <>
              {diagnostics.problems.map((message) => (
                <p key={message} className="route-check danger"><XCircle size={15} aria-hidden="true" />{message}</p>
              ))}
              {diagnostics.warnings.map((message) => (
                <p key={message} className="route-check warn"><AlertTriangle size={15} aria-hidden="true" />{message}</p>
              ))}
            </>
          ) : (
            <p className="route-check ok"><CheckCircle2 size={15} aria-hidden="true" />Toutes les pièces sont connectées depuis le départ.</p>
          )}
        </div>
      </section>
    </div>
  );
}

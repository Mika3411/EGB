import {
  Copy,
  Eraser,
  Magnet,
  Mountain,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ACTION_ZONE_MIN_SIZE,
  ENTITY_Z_MAX,
  ENTITY_Z_MIN,
  FLOOR_ZERO_Z_MAX,
  FLOOR_ZERO_Z_MIN,
  MATERIAL_BRIGHTNESS_MAX,
  MATERIAL_BRIGHTNESS_MIN,
  MODEL_SCALE_MAX,
  MODEL_SCALE_MIN,
  getActionZoneColor,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneOpacity,
  getActionZoneType,
  getActionZoneWidth,
  getCharacterMaterialBrightness,
  getCharacterModelScale,
  getDecorMaterialBrightness,
  getDecorModelScale,
  getEnemyStats,
  getEntityZ,
  getFloorBaseColor,
  getFloorZeroZ,
  getPropHeight,
  getPropModelHeight,
  getPropWidth,
  getReliefElevation,
  getReliefHeight,
  getReliefWidth,
  getWorldCoverTileSize,
} from '../../../shared/utils/rpg3dDomain.js';
import Rpg3DHelpLabel from './Rpg3DHelpLabel.jsx';
import Rpg3DInspectorNumberInput from './Rpg3DInspectorNumberInput.jsx';

export default function Rpg3DInspector({
  actionZoneEdgeInsertMode = false,
  actionZoneNpcTargets,
  activeCanvasId,
  config,
  fieldHelp,
  getEntityRotation,
  getModelRotationValue,
  getNpcChoiceItems,
  getNpcInteractionMode,
  getNpcQuestionText,
  getSelectedEntityTypeLabel,
  hasMultiInspectorSelection,
  inspectorSelectionBounds,
  inspectorSelectionEntities,
  mediaError,
  modelEraserActive,
  modelEraserMaxRadius,
  modelEraserMinRadius,
  modelEraserRadius,
  multiPositionRowClassName,
  multiSelectionAllFlatTiles,
  multiSelectionCanEditActions,
  multiSelectionCanLevitate,
  multiSelectionCanRotate,
  multiSelectionFloorZeroValue,
  multiSelectionRotationValue,
  multiSelectionZValue,
  positionRowClassName,
  reliefStyleOptions,
  rpg3DCanvasOptions,
  selectedCanLevitate,
  selectedCanRotate,
  selectedEntity,
  selectedPropIsFlatTile,
  selectedPropIsFloorTile,
  selectedPropRenderMode,
  selectedPropTileSize,
  selectedReliefStyle,
  selectedModelEraserCount,
  onActionZoneTypeChange,
  onAddSelectedNpcChoice,
  onClearPropImage,
  onDeleteSelected,
  onDuplicateSelected,
  onClearModelEraser,
  onModelEraserRadiusChange,
  onNpcInteractionModeChange,
  onPropCollisionChange,
  onReliefCollisionChange,
  onRemoveSelectedNpcChoice,
  onSnapSelectedTileToNeighbor,
  onToggleActionZoneEdgeInsertMode,
  onToggleModelEraser,
  onUpdateEntity,
  onUpdateSelectedNpcChoice,
  onUpdateSelectionEntities,
}) {
  return (
    <aside className="arcade-builder-panel" aria-label="Inspecteur">
      <div className="arcade-panel-section">
        <h2>Inspecteur</h2>
        {!inspectorSelectionEntities.length ? (
          <p className="arcade-empty-state">Sélectionne un objet sur la carte pour modifier ses réglages.</p>
        ) : hasMultiInspectorSelection ? (
          <div className="arcade-inspector">
            <span className="arcade-selected-type">Selection ({inspectorSelectionEntities.length})</span>
            <div className={multiPositionRowClassName}>
              <label>
                <Rpg3DHelpLabel help={fieldHelp.positionX}>X</Rpg3DHelpLabel>
                <Rpg3DInspectorNumberInput
                  value={Math.round(inspectorSelectionBounds?.centerX || 0)}
                  onCommit={(value) => onUpdateSelectionEntities('x', value)}
                />
              </label>
              <label>
                <Rpg3DHelpLabel help={fieldHelp.positionY}>Y</Rpg3DHelpLabel>
                <Rpg3DInspectorNumberInput
                  value={Math.round(inspectorSelectionBounds?.centerY || 0)}
                  onCommit={(value) => onUpdateSelectionEntities('y', value)}
                />
              </label>
              {multiSelectionCanLevitate ? (
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.positionZ}>Z</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput
                    min={ENTITY_Z_MIN}
                    max={ENTITY_Z_MAX}
                    step="10"
                    value={multiSelectionZValue}
                    placeholder="Mixte"
                    onCommit={(value) => onUpdateSelectionEntities('z', value)}
                  />
                </label>
              ) : null}
              {multiSelectionCanRotate ? (
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.orientation}>Orientation</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput
                    min="0"
                    max="359"
                    step="15"
                    value={multiSelectionRotationValue}
                    placeholder="Mixte"
                    onCommit={(value) => onUpdateSelectionEntities('rotation', value)}
                  />
                </label>
              ) : null}
            </div>
            {multiSelectionAllFlatTiles ? (
              <label>
                <Rpg3DHelpLabel help={fieldHelp.floorZeroZ}>Z 0 personnages</Rpg3DHelpLabel>
                <Rpg3DInspectorNumberInput
                  min={FLOOR_ZERO_Z_MIN}
                  max={FLOOR_ZERO_Z_MAX}
                  step="0.5"
                  value={multiSelectionFloorZeroValue}
                  placeholder="Mixte"
                  onCommit={(value) => onUpdateSelectionEntities('floorZeroZ', value)}
                />
              </label>
            ) : null}
            {multiSelectionCanEditActions ? (
              <div className="arcade-inspector-actions">
                <button type="button" className="secondary-action" onClick={onDuplicateSelected}>
                  <Copy size={15} />
                  <span>Dupliquer</span>
                </button>
                <button type="button" className="danger-button" onClick={onDeleteSelected}>
                  <Trash2 size={15} />
                  <span>Supprimer</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="arcade-inspector">
            <span className="arcade-selected-type">{getSelectedEntityTypeLabel(selectedEntity)}</span>
            <div className={positionRowClassName}>
              <label>
                <Rpg3DHelpLabel help={fieldHelp.positionX}>X</Rpg3DHelpLabel>
                <Rpg3DInspectorNumberInput value={Math.round(selectedEntity.item.x)} onCommit={(value) => onUpdateEntity('x', value)} />
              </label>
              <label>
                <Rpg3DHelpLabel help={fieldHelp.positionY}>Y</Rpg3DHelpLabel>
                <Rpg3DInspectorNumberInput value={Math.round(selectedEntity.item.y)} onCommit={(value) => onUpdateEntity('y', value)} />
              </label>
              {selectedCanLevitate ? (
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.positionZ}>Z</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min={ENTITY_Z_MIN} max={ENTITY_Z_MAX} step="10" value={Math.round(getEntityZ(selectedEntity.item))} onCommit={(value) => onUpdateEntity('z', value)} />
                </label>
              ) : null}
              {selectedCanRotate ? (
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.orientation}>Orientation</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="0" max="359" step="15" value={Math.round(getEntityRotation(selectedEntity.item))} onCommit={(value) => onUpdateEntity('rotation', value)} />
                </label>
              ) : null}
            </div>
            {['hero', 'enemy'].includes(selectedEntity.type) ? (
              <label>
                <Rpg3DHelpLabel help={fieldHelp.characterMaterialBrightness}>Lumiere carte {Math.round(getCharacterMaterialBrightness(selectedEntity.item) * 100)}%</Rpg3DHelpLabel>
                <input
                  type="range"
                  min={MATERIAL_BRIGHTNESS_MIN}
                  max={MATERIAL_BRIGHTNESS_MAX}
                  step="0.05"
                  value={getCharacterMaterialBrightness(selectedEntity.item)}
                  onChange={(event) => onUpdateEntity('characterMaterialBrightness', event.target.value)}
                />
              </label>
            ) : null}
            {selectedEntity.type === 'obstacle' && (
              <>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.width}>Largeur</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="30" value={Math.round(selectedEntity.item.w)} onCommit={(value) => onUpdateEntity('w', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.height}>Hauteur</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="30" value={Math.round(selectedEntity.item.h)} onCommit={(value) => onUpdateEntity('h', value)} />
                </label>
              </>
            )}
            {selectedEntity.type === 'actionZone' && (
              <>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.actionZoneName}>Nom zone</Rpg3DHelpLabel>
                  <input value={selectedEntity.item.name || ''} onChange={(event) => onUpdateEntity('name', event.target.value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.actionZoneType}>Action</Rpg3DHelpLabel>
                  <select
                    value={getActionZoneType(selectedEntity.item)}
                    onChange={(event) => onActionZoneTypeChange(event.target.value)}
                  >
                    <option value="portal">Portail vers canevas</option>
                    <option value="npcAction">Action PNJ</option>
                  </select>
                </label>
                <div className="arcade-enemy-stat-grid">
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.actionZoneWidth}>Largeur</Rpg3DHelpLabel>
                    <Rpg3DInspectorNumberInput min={ACTION_ZONE_MIN_SIZE} max={config.world.width} value={Math.round(getActionZoneWidth(selectedEntity.item))} onCommit={(value) => onUpdateEntity('w', value)} />
                  </label>
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.actionZoneDepth}>Profondeur</Rpg3DHelpLabel>
                    <Rpg3DInspectorNumberInput min={ACTION_ZONE_MIN_SIZE} max={config.world.height} value={Math.round(getActionZoneHeight(selectedEntity.item))} onCommit={(value) => onUpdateEntity('h', value)} />
                  </label>
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.actionZoneModelHeight}>Hauteur 3D</Rpg3DHelpLabel>
                    <Rpg3DInspectorNumberInput min="60" max="900" value={Math.round(getActionZoneModelHeight(selectedEntity.item))} onCommit={(value) => onUpdateEntity('modelHeight', value)} />
                  </label>
                </div>
                <button
                  type="button"
                  className={`secondary-action${actionZoneEdgeInsertMode ? ' active' : ''}`}
                  aria-pressed={actionZoneEdgeInsertMode}
                  onClick={onToggleActionZoneEdgeInsertMode}
                >
                  <Plus size={15} />
                  <span>{actionZoneEdgeInsertMode ? 'Clique une arête' : 'Ajouter arête au clic'}</span>
                </button>
                <div className="arcade-action-zone-veil-grid">
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.actionZoneColor}>Couleur voile</Rpg3DHelpLabel>
                    <input type="color" value={getActionZoneColor(selectedEntity.item)} onChange={(event) => onUpdateEntity('color', event.target.value)} />
                  </label>
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.actionZoneOpacity}>Opacite ({Math.round(getActionZoneOpacity(selectedEntity.item) * 100)}%)</Rpg3DHelpLabel>
                    <input type="range" min="0.05" max="0.95" step="0.05" value={getActionZoneOpacity(selectedEntity.item)} onChange={(event) => onUpdateEntity('opacity', event.target.value)} />
                  </label>
                </div>
                {getActionZoneType(selectedEntity.item) === 'portal' ? (
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.targetCanvas}>Canevas destination</Rpg3DHelpLabel>
                    <select value={selectedEntity.item.targetCanvasId || ''} onChange={(event) => onUpdateEntity('targetCanvasId', event.target.value)}>
                      <option value="">Aucun canevas</option>
                      {rpg3DCanvasOptions.map((canvasOption) => (
                        <option key={canvasOption.id} value={canvasOption.id} disabled={canvasOption.id === activeCanvasId}>
                          {canvasOption.name || 'Canevas'}{canvasOption.id === activeCanvasId ? ' (actuel)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <label>
                      <Rpg3DHelpLabel help={fieldHelp.targetNpc}>PNJ cible</Rpg3DHelpLabel>
                      <select value={selectedEntity.item.targetNpcId || ''} onChange={(event) => onUpdateEntity('targetNpcId', event.target.value)}>
                        <option value="">Aucun personnage</option>
                        {actionZoneNpcTargets.map((target) => (
                          <option key={target.id} value={target.id}>{target.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={fieldHelp.npcInteractionMode}>Interaction</Rpg3DHelpLabel>
                      <select
                        value={getNpcInteractionMode(selectedEntity.item)}
                        onChange={(event) => onNpcInteractionModeChange(event.target.value)}
                      >
                        <option value="message">Message simple</option>
                        <option value="multipleChoice">Question a choix multiples</option>
                      </select>
                    </label>
                    {getNpcInteractionMode(selectedEntity.item) === 'multipleChoice' ? (
                      <div className="arcade-npc-choice-editor">
                        <label>
                          <Rpg3DHelpLabel help={fieldHelp.npcQuestion}>Question PNJ</Rpg3DHelpLabel>
                          <textarea
                            rows="3"
                            value={getNpcQuestionText(selectedEntity.item)}
                            onChange={(event) => onUpdateEntity('npcQuestion', event.target.value)}
                          />
                        </label>
                        {getNpcChoiceItems(selectedEntity.item).map((choice, index) => (
                          <div key={choice.id} className="arcade-npc-choice-row">
                            <label>
                              <Rpg3DHelpLabel help={fieldHelp.npcChoice}>Choix {index + 1}</Rpg3DHelpLabel>
                              <input value={choice.label || ''} onChange={(event) => onUpdateSelectedNpcChoice(choice.id, 'label', event.target.value)} />
                            </label>
                            <label>
                              <Rpg3DHelpLabel help={fieldHelp.npcChoiceResponse}>Retour</Rpg3DHelpLabel>
                              <input value={choice.response || ''} onChange={(event) => onUpdateSelectedNpcChoice(choice.id, 'response', event.target.value)} />
                            </label>
                            <button
                              type="button"
                              className="danger-button compact arcade-npc-choice-remove"
                              onClick={() => onRemoveSelectedNpcChoice(choice.id)}
                              aria-label={`Supprimer le choix ${index + 1}`}
                              disabled={getNpcChoiceItems(selectedEntity.item).length <= 1}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button type="button" className="secondary-action arcade-npc-choice-add" onClick={onAddSelectedNpcChoice}>
                          <Plus size={15} />
                          <span>Ajouter un choix</span>
                        </button>
                      </div>
                    ) : (
                      <label>
                        <Rpg3DHelpLabel help={fieldHelp.zoneMessage}>Action / message</Rpg3DHelpLabel>
                        <input value={selectedEntity.item.message || ''} placeholder="dialogue:cle_ou_texte" onChange={(event) => onUpdateEntity('message', event.target.value)} />
                      </label>
                    )}
                  </>
                )}
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.zoneVisibility}>Mode test</Rpg3DHelpLabel>
                  <input value="Invisible, surbrillance au survol" readOnly aria-readonly="true" />
                </label>
              </>
            )}
            {selectedEntity.type === 'hero' && (
              <>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.heroName}>Nom héros</Rpg3DHelpLabel>
                  <input value={selectedEntity.item.name || ''} onChange={(event) => onUpdateEntity('name', event.target.value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.characterScale}>Taille 3D ({getCharacterModelScale(selectedEntity.item).toFixed(2)})</Rpg3DHelpLabel>
                  <input
                    type="range"
                    min={MODEL_SCALE_MIN}
                    max={MODEL_SCALE_MAX}
                    step="0.05"
                    value={getCharacterModelScale(selectedEntity.item)}
                    onChange={(event) => onUpdateEntity('characterModelScale', Number(event.target.value))}
                  />
                </label>
                <button type="button" className="secondary-action full" onClick={() => onUpdateEntity('characterModelScale', 1)}>
                  Taille par défaut
                </button>
              </>
            )}
            {selectedEntity.type === 'enemy' && (
              <div className="arcade-enemy-stat-grid">
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyHealth}>PV ennemi</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="1" max="999" value={selectedEntity.item.combatEnemyMaxHealth || 8} onCommit={(value) => onUpdateEntity('combatEnemyMaxHealth', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyStrength}>Force</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="0" max="999" value={selectedEntity.item.combatEnemyStrength || 2} onCommit={(value) => onUpdateEntity('combatEnemyStrength', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemySpeed}>Vitesse</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="20" max="420" step="5" value={Math.round(getEnemyStats(selectedEntity.item).speed)} onCommit={(value) => onUpdateEntity('combatEnemySpeed', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyAttackSpeed}>Vitesse attaque</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="0.1" max="8" step="0.1" value={getEnemyStats(selectedEntity.item).attackSpeed.toFixed(1)} onCommit={(value) => onUpdateEntity('combatEnemyAttackSpeed', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyCriticalChance}>% critique</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="0" max="100" step="1" value={Math.round(getEnemyStats(selectedEntity.item).criticalChance)} onCommit={(value) => onUpdateEntity('combatEnemyCriticalChance', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyCriticalMultiplier}>Multiplicateur crit.</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="1" max="8" step="0.1" value={getEnemyStats(selectedEntity.item).criticalMultiplier.toFixed(1)} onCommit={(value) => onUpdateEntity('combatEnemyCriticalMultiplier', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyMana}>Mana ennemi</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="0" max="999" value={selectedEntity.item.combatEnemyMaxMana || 0} onCommit={(value) => onUpdateEntity('combatEnemyMaxMana', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyPowerDamage}>Pouvoir dégâts</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="0" max="999" value={selectedEntity.item.combatEnemyPowerDamage || 0} onCommit={(value) => onUpdateEntity('combatEnemyPowerDamage', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.enemyPowerChance}>Tendance %</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="0" max="100" value={selectedEntity.item.combatEnemyPowerUsageChance || 25} onCommit={(value) => onUpdateEntity('combatEnemyPowerUsageChance', value)} />
                </label>
              </div>
            )}
            {selectedEntity.type === 'pickup' && (
              <label>
                <Rpg3DHelpLabel help={fieldHelp.pickupType}>Bonus</Rpg3DHelpLabel>
                <select value={selectedEntity.item.type} onChange={(event) => onUpdateEntity('type', event.target.value)}>
                  <option value="health">Soin</option>
                  <option value="mana">Mana</option>
                  <option value="energy">Dash</option>
                </select>
              </label>
            )}
            {selectedEntity.type === 'relief' && (
              <>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.reliefName}>Nom relief</Rpg3DHelpLabel>
                  <input value={selectedEntity.item.name || ''} onChange={(event) => onUpdateEntity('name', event.target.value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.reliefStyle}>Type relief</Rpg3DHelpLabel>
                  <select value={selectedEntity.item.style || 'plateau'} onChange={(event) => onUpdateEntity('style', event.target.value)}>
                    {reliefStyleOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div className="arcade-relief-summary">
                  <span
                    className="arcade-relief-token"
                    style={{
                      '--arcade-relief-top': selectedReliefStyle?.top || '#6f4a2e',
                      '--arcade-relief-light': selectedReliefStyle?.light || '#d19a55',
                    }}
                  >
                    <Mountain size={18} />
                  </span>
                  <div>
                    <strong>{selectedReliefStyle?.label || 'Relief'}</strong>
                    <small>{selectedEntity.item.blocksMovement ? 'Bloque le passage' : 'Relief visuel'}</small>
                  </div>
                </div>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.width}>Largeur</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="40" max="1400" value={Math.round(getReliefWidth(selectedEntity.item))} onCommit={(value) => onUpdateEntity('w', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.reliefDepth}>Profondeur</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="40" max="1000" value={Math.round(getReliefHeight(selectedEntity.item))} onCommit={(value) => onUpdateEntity('h', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.reliefElevation}>Hauteur relief</Rpg3DHelpLabel>
                  <Rpg3DInspectorNumberInput min="-80" max="120" value={Math.round(getReliefElevation(selectedEntity.item))} onCommit={(value) => onUpdateEntity('elevation', value)} />
                </label>
                <label>
                  <Rpg3DHelpLabel help={fieldHelp.collision}>Collision</Rpg3DHelpLabel>
                  <select
                    value={selectedEntity.item.blocksMovement ? 'blocked' : 'free'}
                    onChange={(event) => onReliefCollisionChange(event.target.value)}
                  >
                    <option value="free">Passage libre</option>
                    <option value="blocked">Bloque le passage</option>
                  </select>
                </label>
              </>
            )}
            {selectedEntity.type === 'prop' && (
              <>
                {selectedPropRenderMode === 'glb' ? (
                  <>
                    <label>
                      <Rpg3DHelpLabel help={fieldHelp.decorScale}>Echelle 3D ({getDecorModelScale(selectedEntity.item).toFixed(1)}x)</Rpg3DHelpLabel>
                      <input type="range" min={MODEL_SCALE_MIN} max={MODEL_SCALE_MAX} step="0.05" value={getDecorModelScale(selectedEntity.item)} onChange={(event) => onUpdateEntity('decorModelScale', event.target.value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={fieldHelp.materialBrightness}>Lumiere carte {Math.round(getDecorMaterialBrightness(selectedEntity.item) * 100)}%</Rpg3DHelpLabel>
                      <input type="range" min={MATERIAL_BRIGHTNESS_MIN} max={MATERIAL_BRIGHTNESS_MAX} step="0.05" value={getDecorMaterialBrightness(selectedEntity.item)} onChange={(event) => onUpdateEntity('materialBrightness', event.target.value)} />
                    </label>
                    <div className="arcade-model-eraser-tools">
                      <div className="arcade-model-eraser-actions">
                        <button
                          type="button"
                          className={`secondary-action arcade-model-eraser-button${modelEraserActive ? ' active' : ''}`}
                          aria-pressed={modelEraserActive}
                          onClick={onToggleModelEraser}
                        >
                          <Eraser size={15} />
                          <span>{modelEraserActive ? 'Gomme active' : 'Gomme GLB'}</span>
                        </button>
                        <button
                          type="button"
                          className="secondary-action arcade-model-eraser-clear"
                          onClick={onClearModelEraser}
                          disabled={!selectedModelEraserCount}
                          title={selectedModelEraserCount ? 'Retirer les zones gommees' : 'Aucune zone gommee'}
                          aria-label="Retirer les zones gommees"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <label>
                        <Rpg3DHelpLabel help={fieldHelp.modelEraserRadius}>Rayon gomme {Math.round(modelEraserRadius)}</Rpg3DHelpLabel>
                        <input
                          type="range"
                          min={modelEraserMinRadius}
                          max={modelEraserMaxRadius}
                          step="4"
                          value={modelEraserRadius}
                          onChange={(event) => onModelEraserRadiusChange(event.target.value)}
                        />
                      </label>
                    </div>
                  </>
                ) : null}
                <div className="arcade-model-orientation-grid">
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.rotationX}>Inclinaison X</Rpg3DHelpLabel>
                    <Rpg3DInspectorNumberInput min="-180" max="180" step="15" value={getModelRotationValue(selectedEntity.item, 'modelRotationX')} onCommit={(value) => onUpdateEntity('modelRotationX', value)} />
                  </label>
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.rotationY}>Axe Y</Rpg3DHelpLabel>
                    <Rpg3DInspectorNumberInput min="-180" max="180" step="15" value={getModelRotationValue(selectedEntity.item, 'modelRotationY')} onCommit={(value) => onUpdateEntity('modelRotationY', value)} />
                  </label>
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.rotationZ}>Inclinaison Z</Rpg3DHelpLabel>
                    <Rpg3DInspectorNumberInput min="-180" max="180" step="15" value={getModelRotationValue(selectedEntity.item, 'modelRotationZ')} onCommit={(value) => onUpdateEntity('modelRotationZ', value)} />
                  </label>
                </div>
                {selectedPropIsFlatTile ? (
                  <>
                    {selectedPropIsFloorTile ? (
                      <label>
                        <Rpg3DHelpLabel help={fieldHelp.floorTileSize}>Taille carre</Rpg3DHelpLabel>
                        <Rpg3DInspectorNumberInput min="12" max={getWorldCoverTileSize(config.world)} value={selectedPropTileSize} onCommit={(value) => onUpdateEntity('w', value)} />
                      </label>
                    ) : null}
                    {selectedPropIsFloorTile ? (
                      <div className="arcade-action-zone-veil-grid arcade-floor-color-grid">
                        <label>
                          <Rpg3DHelpLabel help={fieldHelp.floorColor}>Couleur sol</Rpg3DHelpLabel>
                          <input type="color" value={getFloorBaseColor(selectedEntity.item)} onChange={(event) => onUpdateEntity('baseColor', event.target.value)} />
                        </label>
                      </div>
                    ) : null}
                    <label>
                      <Rpg3DHelpLabel help={fieldHelp.floorZeroZ}>Z 0 personnages</Rpg3DHelpLabel>
                      <Rpg3DInspectorNumberInput
                        min={FLOOR_ZERO_Z_MIN}
                        max={FLOOR_ZERO_Z_MAX}
                        step="0.5"
                        value={getFloorZeroZ(selectedEntity.item)}
                        onCommit={(value) => onUpdateEntity('floorZeroZ', value)}
                      />
                    </label>
                    <button type="button" className="secondary-action arcade-tile-snap-button" onClick={onSnapSelectedTileToNeighbor}>
                      <Magnet size={15} />
                      <span>Aimant</span>
                    </button>
                  </>
                ) : null}
                {selectedEntity.item.imageData ? (
                  <button type="button" className="secondary-action" onClick={onClearPropImage}>Retirer image decor</button>
                ) : null}
                {mediaError ? <p className="arcade-empty-state">{mediaError}</p> : null}
                {selectedPropIsFloorTile ? null : selectedEntity.item.imageData ? (
                  <>
                    <label>
                      <Rpg3DHelpLabel help={fieldHelp.propWidth}>Largeur</Rpg3DHelpLabel>
                      <Rpg3DInspectorNumberInput min="12" max="600" value={Math.round(getPropWidth(selectedEntity.item))} onCommit={(value) => onUpdateEntity('w', value)} />
                    </label>
                    <label>
                      <Rpg3DHelpLabel help={fieldHelp.propDepth}>Profondeur / longueur</Rpg3DHelpLabel>
                      <Rpg3DInspectorNumberInput min="12" max="600" value={Math.round(getPropHeight(selectedEntity.item))} onCommit={(value) => onUpdateEntity('h', value)} />
                    </label>
                    {selectedPropRenderMode !== 'floor' ? (
                      <label>
                        <Rpg3DHelpLabel help={fieldHelp.propModelHeight}>Hauteur 3D</Rpg3DHelpLabel>
                        <Rpg3DInspectorNumberInput min="12" max="800" value={Math.round(getPropModelHeight(selectedEntity.item))} onCommit={(value) => onUpdateEntity('modelHeight', value)} />
                      </label>
                    ) : null}
                  </>
                ) : (
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.propModelHeight}>Hauteur 3D</Rpg3DHelpLabel>
                    <Rpg3DInspectorNumberInput min="12" max="800" value={Math.round(getPropModelHeight(selectedEntity.item))} onCommit={(value) => onUpdateEntity('modelHeight', value)} />
                  </label>
                )}
                {!selectedPropIsFloorTile ? (
                  <label>
                    <Rpg3DHelpLabel help={fieldHelp.collision}>Collision</Rpg3DHelpLabel>
                    <select
                      value={selectedEntity.item.blocksMovement ? 'blocked' : 'free'}
                      onChange={(event) => onPropCollisionChange(event.target.value)}
                    >
                      <option value="free">Passage libre</option>
                      <option value="blocked">Bloque le passage</option>
                    </select>
                  </label>
                ) : null}
              </>
            )}
            <div className="arcade-inspector-actions">
              <button type="button" className="secondary-action" onClick={onDuplicateSelected}>
                <Copy size={15} />
                <span>Dupliquer</span>
              </button>
              <button type="button" className="danger-button" onClick={onDeleteSelected}>
                <Trash2 size={15} />
                <span>Supprimer</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </aside>
  );
}

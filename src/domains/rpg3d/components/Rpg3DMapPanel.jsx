import {
  Camera,
  Eraser,
  Map as MapIcon,
  MousePointerClick,
  Paintbrush,
  Square,
} from 'lucide-react';
import Rpg3DHelpLabel from './Rpg3DHelpLabel.jsx';
import Rpg3DMapNumberField from './Rpg3DMapNumberField.jsx';

export default function Rpg3DMapPanel({
  AssetExplorerComponent,
  arcadeObjectCount,
  decors,
  fieldHelp,
  flatGroundColorValue,
  lightIntensityValue,
  lightOrientationValue,
  paintBrushColor,
  paintBrushRadius,
  paintBrushShape,
  terrainPaintMaxRadius,
  terrainPaintMinRadius,
  terrainPaintShapeOptions,
  terrainPaintStrokeCount,
  tool,
  world,
  characters,
  onAddFlatGround,
  onClearTerrainPaint,
  onImportCharacter,
  onImportDecor,
  onLightIntensityChange,
  onLightOrientationChange,
  onSelectActionZoneTool,
  onTerrainPaintDraftChange,
  onToggleTerrainPaint,
  onUpdateFlatGroundColor,
  onWorldFieldCommit,
}) {
  return (
    <aside className="arcade-builder-panel arcade-map-card" aria-label="Carte">
      <div className="arcade-panel-section">
        <div className="arcade-map-card-summary">
          <h2><MapIcon size={13} /> Carte</h2>
          <div className="arcade-map-card-grid">
            <Rpg3DMapNumberField
              label="Largeur"
              help={fieldHelp.mapWidth}
              ariaLabel="Largeur de la carte"
              min="1200"
              max="9000"
              step="100"
              value={world.width}
              onCommit={(value) => onWorldFieldCommit('width', value)}
            />
            <Rpg3DMapNumberField
              label="Hauteur"
              help={fieldHelp.mapHeight}
              ariaLabel="Hauteur de la carte"
              min="900"
              max="7000"
              step="100"
              value={world.height}
              onCommit={(value) => onWorldFieldCommit('height', value)}
            />
            <Rpg3DMapNumberField
              label="Grille"
              help={fieldHelp.mapGrid}
              ariaLabel="Taille de grille"
              min="40"
              max="240"
              step="20"
              value={world.grid}
              onCommit={(value) => onWorldFieldCommit('grid', value)}
            />
            <div className="arcade-map-card-field arcade-map-card-object-field">
              <input
                className="arcade-map-card-input"
                type="number"
                min="0"
                value={arcadeObjectCount}
                aria-label="Objets sur la carte"
                readOnly
              />
              <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.mapObjects}>Objets</Rpg3DHelpLabel>
            </div>
          </div>
        </div>
        <div className="arcade-map-light-controls" aria-label="Eclairage de la carte">
          <h2><Camera size={12} /> Lumière</h2>
          <label>
            <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.lightIntensity}>Intensite {Math.round(lightIntensityValue * 100)}%</Rpg3DHelpLabel>
            <input type="range" min="0.25" max="2.6" step="0.05" value={lightIntensityValue} onChange={(event) => onLightIntensityChange(Number(event.target.value))} />
          </label>
          <label>
            <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.lightOrientation}>Orientation {Math.round(lightOrientationValue)} deg</Rpg3DHelpLabel>
            <input type="range" min="0" max="359" step="1" value={lightOrientationValue} onChange={(event) => onLightOrientationChange(Number(event.target.value))} />
          </label>
        </div>
        {AssetExplorerComponent ? (
          <AssetExplorerComponent
            characters={characters}
            decors={decors}
            onImportCharacter={onImportCharacter}
            onImportDecor={onImportDecor}
          />
        ) : null}
        <div className="arcade-map-terrain-actions" aria-label="Terrain">
          <label className="arcade-flat-ground-color-field">
            <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.flatGroundColor}>Plateau</Rpg3DHelpLabel>
            <input
              type="color"
              value={flatGroundColorValue}
              onChange={(event) => onUpdateFlatGroundColor(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="secondary-action arcade-map-ground-button"
            onClick={onAddFlatGround}
          >
            <Square size={15} />
            <span>Sol plat</span>
          </button>
          <button
            type="button"
            className={`secondary-action arcade-map-paint-button${tool === 'terrainPaint' ? ' active' : ''}`}
            aria-pressed={tool === 'terrainPaint'}
            onClick={onToggleTerrainPaint}
          >
            <Paintbrush size={15} />
            <span>Peindre</span>
          </button>
        </div>
        <div className="arcade-terrain-paint-controls">
          <label className="arcade-terrain-color-field">
            <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.terrainPaintColor}>Couleur</Rpg3DHelpLabel>
            <input
              type="color"
              value={paintBrushColor}
              onChange={(event) => onTerrainPaintDraftChange('color', event.target.value)}
            />
          </label>
          <label>
            <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.terrainPaintBrush}>Brosse {Math.round(paintBrushRadius)}</Rpg3DHelpLabel>
            <input
              type="range"
              min={terrainPaintMinRadius}
              max={terrainPaintMaxRadius}
              step="8"
              value={paintBrushRadius}
              onChange={(event) => onTerrainPaintDraftChange('radius', event.target.value)}
            />
          </label>
          <div className="arcade-terrain-shape-field">
            <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.terrainPaintShape}>Forme</Rpg3DHelpLabel>
            <div className="arcade-terrain-shape-buttons">
              {terrainPaintShapeOptions.map(({ id, label, icon: ShapeIcon }) => (
                <button
                  key={id}
                  type="button"
                  className={`secondary-action arcade-terrain-shape-button${paintBrushShape === id ? ' active' : ''}`}
                  aria-label={`Pinceau ${label.toLowerCase()}`}
                  aria-pressed={paintBrushShape === id}
                  title={`Pinceau ${label.toLowerCase()}`}
                  onClick={() => onTerrainPaintDraftChange('shape', id)}
                >
                  <ShapeIcon size={14} />
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="secondary-action arcade-terrain-clear-button"
            onClick={onClearTerrainPaint}
            disabled={!terrainPaintStrokeCount}
            title={terrainPaintStrokeCount ? 'Effacer la peinture du terrain' : 'Aucune peinture terrain'}
          >
            <Eraser size={14} />
          </button>
        </div>
        <div className="arcade-map-card-actions">
          <button
            type="button"
            className={`secondary-action arcade-map-zone-button${tool === 'actionZone' ? ' active' : ''}`}
            aria-pressed={tool === 'actionZone'}
            onClick={onSelectActionZoneTool}
          >
            <MousePointerClick size={15} />
            <span>Ajouter zone</span>
          </button>
          <Rpg3DHelpLabel className="arcade-map-card-help-label" help={fieldHelp.actionZoneTool}>Zone d'action</Rpg3DHelpLabel>
        </div>
      </div>
    </aside>
  );
}

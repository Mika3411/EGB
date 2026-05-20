import {
  Cuboid,
  List,
  Orbit,
} from 'lucide-react';

export default function Rpg3DControls({
  ActiveWorkspaceIcon,
  activeWorkspace,
  arcadeObjectCount,
  dashReady,
  pendingPlacement,
  playMode,
  snapshot,
  studioProject,
  tool,
  workspaceTab,
}) {
  return (
    <section className="arcade-controls" aria-label="Controles">
      {workspaceTab === 'arcade' ? (
        <>
          <span><Cuboid size={14} /> Vue 3D: clic sol pour placer</span>
          <span>{pendingPlacement ? 'Placement: deplace la souris, clic gauche pour deposer' : playMode ? 'Clic gauche: deplacement' : tool === 'terrainPaint' ? 'Peinture sol: clic gauche maintenu' : 'Selection: choisir un objet'}</span>
          <span>{playMode ? 'F: tir' : <><Orbit size={14} /> Orbit: clic gauche maintenu autour du point</>}</span>
          <span>Clic droit maintenu: glisse camera a l ecran</span>
          {playMode ? <span>{`Espace: dash ${dashReady ? 'pret' : 'en recharge'}`}</span> : null}
          <span>{playMode ? 'Q/E: pouvoir mana' : 'Mode 3D uniquement'}</span>
          {playMode && snapshot.actionMessage ? <span>{snapshot.actionMessage}</span> : null}
          <span>P: pause</span>
        </>
      ) : workspaceTab === 'management' ? (
        <>
          <span><List size={14} /> Gestion</span>
          <span>{(studioProject.characterModels3d || []).length + (studioProject.decorModels3d || []).length} modeles 3D</span>
          <span>{arcadeObjectCount} elements sur la carte</span>
        </>
      ) : (
        <>
          <span><ActiveWorkspaceIcon size={14} /> {activeWorkspace.label}</span>
          <span>Clic gauche maintenu: rotation autour du point clique</span>
          <span>Clic droit maintenu: glisse camera a l ecran</span>
          <span>{workspaceTab === 'decors3d' ? 'Image importee: texture appliquee au modele 3D' : 'Modele importe: personnage 3D'}</span>
        </>
      )}
    </section>
  );
}

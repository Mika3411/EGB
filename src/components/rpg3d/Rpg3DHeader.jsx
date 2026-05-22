import {
  Map as MapIcon,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { getUserDisplayName } from '../../utils/userDisplayName';

export default function Rpg3DHeader({
  authorProfile = null,
  isPaused,
  isSavingAssets,
  managementSaveStatus,
  playMode,
  user = null,
  workspaceTab,
  onPauseOrReset,
  onSave,
  onSelectWorkspace,
  onTogglePlayMode,
}) {
  const userDisplayName = getUserDisplayName(user, authorProfile);
  const userEmail = String(user?.email || '').trim();

  return (
    <section className="arcade-hud" aria-label="RPG 3D no-code builder">
      <div>
        <span className="arcade-kicker"><Sparkles size={15} /> Moteur RPG 3D no-code</span>
        <h1>RPG 3D Builder</h1>
      </div>
      <div className={`arcade-account-chip ${user?.id ? 'connected' : 'disconnected'}`}>
        <UserRound size={16} />
        <div>
          <small>{user?.id ? 'Compte connecte' : 'Compte non connecte'}</small>
          <strong>{user?.id ? userDisplayName : 'Sauvegarde locale'}</strong>
          {userEmail && userEmail !== userDisplayName ? <span>{userEmail}</span> : null}
        </div>
      </div>
      <div className="arcade-actions">
        {workspaceTab === 'arcade' ? (
          <>
            <button
              type="button"
              className={playMode ? 'secondary-action' : 'button like'}
              onClick={onTogglePlayMode}
            >
              {playMode ? <MousePointer2 size={16} /> : <Play size={16} />}
              <span>{playMode ? 'Editer' : 'Tester'}</span>
            </button>
            <button type="button" className="secondary-action" onClick={onPauseOrReset}>
              {playMode && !isPaused ? <Pause size={16} /> : <RotateCcw size={16} />}
              <span>{playMode ? (isPaused ? 'Reprendre' : 'Pause') : 'Recharger'}</span>
            </button>
            <button
              type="button"
              className="secondary-action arcade-save-action"
              onClick={onSave}
              disabled={isSavingAssets}
              title={managementSaveStatus || 'Sauvegarder le RPG 3D'}
            >
              <Save size={16} />
              <span>{isSavingAssets ? 'Sauvegarde...' : 'Sauvegarder'}</span>
            </button>
          </>
        ) : (
          <button type="button" className="secondary-action" onClick={() => onSelectWorkspace('arcade')}>
            <MapIcon size={16} />
            <span>Retour carte</span>
          </button>
        )}
      </div>
    </section>
  );
}

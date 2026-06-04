import { useCallback, useMemo, useState } from 'react';
import StuntAnimationWorkspace from './StuntAnimationWorkspace.jsx';

const createStandaloneProject = () => ({
  title: 'Animation cascadeur',
  creationMode: 'expert',
  characterModels3d: [
    { id: 'standalone_actor', name: 'Cascadeur test', role: 'hero' },
  ],
  stuntAnimations: [],
});

export default function StuntAnimationStudio({ onBack }) {
  const initialProject = useMemo(() => createStandaloneProject(), []);
  const [project, setProject] = useState(initialProject);
  const patchProject = useCallback((updater) => {
    setProject((current) => {
      const next = structuredClone(current);
      updater(next);
      return next;
    });
  }, []);

  return (
    <main className="stunt-standalone-page">
      <header className="stunt-standalone-header">
        <div>
          <span className="eyebrow">Prototype</span>
          <h1>Animation cascadeur</h1>
        </div>
        <button type="button" className="secondary-action" onClick={onBack}>
          Retour
        </button>
      </header>
      <StuntAnimationWorkspace project={project} patchProject={patchProject} />
    </main>
  );
}

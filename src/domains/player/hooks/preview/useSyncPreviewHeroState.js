import { useEffect } from 'react';

export const useSyncPreviewHeroState = (heroAdventure, setHeroState, engineRef) => {
  useEffect(() => {
    if (!heroAdventure.enabled) return;
    setHeroState((current) => {
      const nextHero = {
        ...current,
        name: heroAdventure.hero.name,
        backgroundImageData: heroAdventure.hero.backgroundImageData || '',
        characterImageData: heroAdventure.hero.characterImageData || '',
        setupBackgroundImageData: heroAdventure.hero.setupBackgroundImageData || '',
        setupMusicData: heroAdventure.hero.setupMusicData || '',
        setupMusicName: heroAdventure.hero.setupMusicName || '',
        defeatSceneId: heroAdventure.hero.defeatSceneId || '',
        powers: heroAdventure.hero.powers || [],
        resistanceWater: heroAdventure.hero.resistanceWater || 0,
        resistanceEarth: heroAdventure.hero.resistanceEarth || 0,
        resistanceFire: heroAdventure.hero.resistanceFire || 0,
        resistanceLightning: heroAdventure.hero.resistanceLightning || 0,
      };
      engineRef.current.setState({ heroState: nextHero });
      return nextHero;
    });
  }, [
    engineRef,
    heroAdventure.enabled,
    heroAdventure.hero.name,
    heroAdventure.hero.backgroundImageData,
    heroAdventure.hero.characterImageData,
    heroAdventure.hero.setupBackgroundImageData,
    heroAdventure.hero.setupMusicData,
    heroAdventure.hero.setupMusicName,
    heroAdventure.hero.defeatSceneId,
    heroAdventure.hero.powers,
    heroAdventure.hero.resistanceWater,
    heroAdventure.hero.resistanceEarth,
    heroAdventure.hero.resistanceFire,
    heroAdventure.hero.resistanceLightning,
    setHeroState,
  ]);
};

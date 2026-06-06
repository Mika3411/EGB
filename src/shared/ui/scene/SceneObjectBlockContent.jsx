import {
  getSceneObjectBlockStyle,
  getSceneObjectBlockType,
} from '../../services/sceneObjectBlocks';

export function SceneObjectBlockContent({ object, displayImage = '', linkedItem = null }) {
  const blockType = getSceneObjectBlockType(object);
  const title = object.blockLabel || object.name || linkedItem?.name || 'Bloc';
  const text = object.blockText || object.dialogue || title;

  const blockStyle = getSceneObjectBlockStyle(object);

  if (blockType === 'text') {
    return <span className="interactive-block interactive-block--text" style={blockStyle}>{text}</span>;
  }
  if (blockType === 'hint') {
    return (
      <span className="interactive-block interactive-block--hint" style={blockStyle}>
        <strong>{title || 'Indice'}</strong>
        <small>{text || 'Un indice est disponible.'}</small>
      </span>
    );
  }
  if (blockType === 'button') {
    return <span className="interactive-block interactive-block--button" style={blockStyle}>{object.buttonLabel || title || 'Bouton'}</span>;
  }
  if (blockType === 'input') {
    return (
      <span className="interactive-block interactive-block--field" style={blockStyle}>
        <strong>{title || 'Réponse'}</strong>
        <small>{object.placeholder || 'Saisir une réponse...'}</small>
      </span>
    );
  }
  if (blockType === 'code') {
    const slots = Math.max(3, Math.min(8, String(object.expectedAnswer || '0000').length || 4));
    return (
      <span className="interactive-block interactive-block--code" style={blockStyle}>
        <strong>{title || 'Code'}</strong>
        <span>{Array.from({ length: slots }, () => '•').join(' ')}</span>
      </span>
    );
  }
  if (blockType === 'image' && !displayImage) {
    return <span className="interactive-block interactive-block--image" style={blockStyle}>{title || 'Image'}</span>;
  }
  if (displayImage) return <img src={displayImage} alt={title} />;
  return <span>{object.isInvisible ? `${object.name || 'Objet'} (invisible)` : title}</span>;
}

export default SceneObjectBlockContent;

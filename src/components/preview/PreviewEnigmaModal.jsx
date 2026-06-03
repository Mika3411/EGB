import React from 'react';
import PreviewEnigmaContent from './PreviewEnigmaContent.jsx';
import PreviewEnigmaOverlay from './PreviewEnigmaOverlay.jsx';

export default function PreviewEnigmaModal({
  enigma,
  overlayStyle,
  closeEnigma,
  project,
  controls = {},
}) {
  if (!enigma) return null;
  const {
    enigmaCodeInput,
    setEnigmaCodeInput,
    submitEnigma,
    enigmaColorAttempt,
    setEnigmaColorAttempt,
    pushEnigmaColor,
    simonPlayerTurn,
    simonPlaybackIndex,
    startSimonPlayback,
    enigmaPuzzleOrder,
    enigmaPuzzleSelectedIndex,
    clickPuzzlePiece,
    enigmaRotationAngles,
    rotatePuzzlePiece,
    enigmaDragSlots,
    returnDragPieceToBank,
    moveDragPieceToSlot,
    enigmaDraggedPiece,
    setEnigmaDraggedPiece,
    enigmaDragBank,
  } = controls;

  return (
    <PreviewEnigmaOverlay enigma={enigma} overlayStyle={overlayStyle} closeEnigma={closeEnigma}>
      <PreviewEnigmaContent
        enigma={enigma}
        project={project}
        enigmaCodeInput={enigmaCodeInput}
        setEnigmaCodeInput={setEnigmaCodeInput}
        submitEnigma={submitEnigma}
        enigmaColorAttempt={enigmaColorAttempt}
        setEnigmaColorAttempt={setEnigmaColorAttempt}
        pushEnigmaColor={pushEnigmaColor}
        simonPlayerTurn={simonPlayerTurn}
        simonPlaybackIndex={simonPlaybackIndex}
        startSimonPlayback={startSimonPlayback}
        enigmaPuzzleOrder={enigmaPuzzleOrder}
        enigmaPuzzleSelectedIndex={enigmaPuzzleSelectedIndex}
        clickPuzzlePiece={clickPuzzlePiece}
        enigmaRotationAngles={enigmaRotationAngles}
        rotatePuzzlePiece={rotatePuzzlePiece}
        enigmaDragSlots={enigmaDragSlots}
        returnDragPieceToBank={returnDragPieceToBank}
        moveDragPieceToSlot={moveDragPieceToSlot}
        enigmaDraggedPiece={enigmaDraggedPiece}
        setEnigmaDraggedPiece={setEnigmaDraggedPiece}
        enigmaDragBank={enigmaDragBank}
      />
    </PreviewEnigmaOverlay>
  );
}

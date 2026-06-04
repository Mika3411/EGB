export const standaloneConversationRenderOverrides = `
function renderConversationReplyButton(reply) {
  const isLocked = !isConversationReplyAvailable(reply);
  const reason = isLocked ? getConversationReplyLockReason(reply) : '';
  const replyLabel = getVisitedAwareReplyLabel(reply, { visitedSceneIds: state.visitedSceneIds }) || 'Repondre';
  return '<button type="button" class="secondary-action' + (isLocked ? ' conversation-reply-locked' : '') + '" '
    + (isLocked ? 'disabled title="' + escapeAttr(reason || 'Choix verrouille') + '"' : 'data-conversation-reply="' + safeDataAttr(reply.id) + '"')
    + '><span>' + safeHtml(replyLabel) + '</span>'
    + (isLocked ? '<small>' + safeHtml(reason || 'Choix verrouille') + '</small>' : '')
    + '</button>';
}

function renderConversationReplies(displayedReplies = []) {
  const replyColumnClass = 'conversation-player-replies-' + Math.min(3, Math.max(1, displayedReplies.length || 1));
  const usesAdventureLayout = IS_CHOICE_ADVENTURE || IS_HERO_ADVENTURE;
  return '<div class="stack-10' + (usesAdventureLayout ? ' conversation-player-replies ' + safeClassToken(replyColumnClass, 'conversation-player-replies-1') : '') + '">'
    + (displayedReplies.length ? displayedReplies.map(renderConversationReplyButton).join('') : '<button id="close-conversation" type="button">Continuer</button>')
    + '</div>';
}

function renderConversation() {
  const conversation = state.activeConversation?.conversation;
  const node = conversation?.nodes?.find((entry) => entry.id === state.activeConversation.nodeId);
  if (!node) return '';
  const visibleReplies = (node.replies || []).filter(isConversationReplyAvailable);
  const shouldShowLockedReplies = IS_CHOICE_ADVENTURE || IS_HERO_ADVENTURE;
  const lockedReplies = shouldShowLockedReplies ? (node.replies || []).filter((reply) => {
    const isConsumed = reply.id && (
      state.hiddenConversationReplyIds.includes(reply.id)
      || (reply.hideAfterChosen && state.chosenConversationReplyIds.includes(reply.id))
    );
    return !isConversationReplyAvailable(reply) && reply.showWhenLocked && !isConsumed;
  }) : [];
  const displayedReplies = visibleReplies.concat(lockedReplies);
  const usesAdventureLayout = IS_CHOICE_ADVENTURE || IS_HERO_ADVENTURE;
  return '<div class="overlay' + (usesAdventureLayout ? ' conversation-player-overlay' : '') + '"><div class="overlay-card wide' + (usesAdventureLayout ? ' conversation-player-card' : '') + '">'
    + renderConversationHeader(node)
    + renderChoiceEffectSummary(true)
    + renderConversationReplies(displayedReplies)
    + '</div></div>';
}
`;

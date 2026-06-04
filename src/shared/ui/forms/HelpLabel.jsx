export const positionHelpBubble = (event) => {
  const dot = event.currentTarget;
  const rect = dot.getBoundingClientRect();
  const bubbleWidth = Math.min(300, Math.max(220, window.innerWidth - 24));
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - bubbleWidth - 12);
  const top = Math.min(Math.max(12, rect.bottom + 8), window.innerHeight - 120);

  dot.style.setProperty('--help-left', `${left}px`);
  dot.style.setProperty('--help-top', `${top}px`);
  dot.style.setProperty('--help-width', `${bubbleWidth}px`);
};

export default function HelpLabel({ children, help, className = '', as: Tag = 'label', ...props }) {
  return (
    <Tag className={`label-with-help${className ? ` ${className}` : ''}`} {...props}>
      <span>{children}</span>
      <span
        className="help-dot"
        data-help={help}
        aria-label={help}
        tabIndex={0}
        onMouseEnter={positionHelpBubble}
        onFocus={positionHelpBubble}
      >
        ?
      </span>
    </Tag>
  );
}

export default function HelpLabel({ children, help, className = '' }) {
  return (
    <label className={`label-with-help${className ? ` ${className}` : ''}`}>
      <span>{children}</span>
      <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
    </label>
  );
}

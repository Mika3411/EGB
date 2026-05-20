import HelpLabel from '../forms/HelpLabel.jsx';

export default function Rpg3DHelpLabel({ children, help, className = '' }) {
  return (
    <HelpLabel as="span" className={`builder3d-help-label${className ? ` ${className}` : ''}`} help={help}>
      {children}
    </HelpLabel>
  );
}

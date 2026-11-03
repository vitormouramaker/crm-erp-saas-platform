import type { ReactNode } from 'react';
import { getInitials } from '../../../utils/string';
import './Avatar.css';

interface AvatarProps {
  name: string;
  color?: string;
  imageUrl?: string | null;
  icon?: ReactNode;
  size?: 'xsmall' | 'small' | 'medium';
  className?: string;
}

export function Avatar({
  name,
  imageUrl,
  icon,
  size = 'medium',
  className = '',
}: AvatarProps) {
  const initials = getInitials(name);
  const normalizedImageUrl = String(imageUrl || '').trim();
  const hasImage = normalizedImageUrl.length > 0;
  const hasIcon = !hasImage && Boolean(icon);

  return (
    <div
      className={`avatar-container ${size} ${hasImage ? 'has-image' : ''} ${className}`.trim()}
      title={name}
    >
      {hasImage ? (
        <img className="avatar-image" src={normalizedImageUrl} alt={name} />
      ) : hasIcon ? (
        <span className="avatar-icon" aria-hidden="true">{icon}</span>
      ) : (
        <span className="avatar-initials">{initials}</span>
      )}
    </div>
  );
}

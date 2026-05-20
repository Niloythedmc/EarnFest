import React from 'react';

/**
 * Enhanced Skeleton Component for premium loading experience
 * @param {Object} props
 * @param {string} [props.width] - Optional width (e.g., '100%', '50px')
 * @param {string} [props.height] - Optional height (e.g., '20px', '100%')
 * @param {string} [props.borderRadius] - Optional border radius (e.g., '50%', '12px')
 * @param {string} [props.variant] - Variant: 'text', 'circle', 'rect', 'card'
 * @param {Object} [props.style] - Additional inline styles
 * @param {string} [props.className] - Extra class names
 */
const Skeleton = ({ 
  width, 
  height, 
  borderRadius, 
  variant = 'rect', 
  style = {}, 
  className = '' 
}) => {
  const getStyles = () => {
    const base = {
      width: width || (variant === 'circle' ? '50px' : '100%'),
      height: height || (variant === 'circle' ? '50px' : variant === 'text' ? '14px' : '60px'),
      borderRadius: borderRadius || (variant === 'circle' ? '50%' : variant === 'card' ? '24px' : '8px'),
      ...style
    };

    if (variant === 'text') {
      base.marginTop = style.marginTop || '4px';
      base.marginBottom = style.marginBottom || '4px';
    }

    return base;
  };

  return (
    <div 
      className={`skeleton-base ${className}`} 
      style={getStyles()}
    />
  );
};

export default Skeleton;

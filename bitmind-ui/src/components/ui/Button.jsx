import React from 'react';
import './Button.css';

/**
 * Reusable Button Component
 * Supports primary and secondary variants
 */
const Button = ({ 
  children, 
  variant = 'primary', 
  onClick, 
  disabled = false, 
  loading = false,
  className = '',
  ...props 
}) => {
  const baseClasses = 'btn';
  const variantClasses = `btn-${variant}`;
  const stateClasses = disabled ? 'btn-disabled' : loading ? 'btn-loading' : '';
  const combinedClasses = `${baseClasses} ${variantClasses} ${stateClasses} ${className}`.trim();

  return (
    <button
      className={combinedClasses}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="btn-spinner"></span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;

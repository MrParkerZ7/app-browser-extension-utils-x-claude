import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  if (label) {
    return (
      <label>
        {label}
        <input className={className} {...props} />
      </label>
    );
  }

  return <input className={className} {...props} />;
}

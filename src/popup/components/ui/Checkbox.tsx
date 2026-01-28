import { InputHTMLAttributes, ReactNode } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  labelClassName?: string;
}

export function Checkbox({ label, labelClassName = '', className = '', ...props }: CheckboxProps) {
  if (label) {
    return (
      <label className={labelClassName}>
        <input type="checkbox" className={className} {...props} />
        {typeof label === 'string' ? <span>{label}</span> : label}
      </label>
    );
  }

  return <input type="checkbox" className={className} {...props} />;
}

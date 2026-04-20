import type { ReactNode } from 'react';

type ToggleSwitchProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  className?: string;
  labelClassName?: string;
};

export function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled,
  label,
  className = '',
  labelClassName = '',
}: ToggleSwitchProps) {
  return (
    <label htmlFor={id} className={`toggle-switch ${className}`.trim()}>
      <input
        type="checkbox"
        id={id}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="toggle-switch-track" aria-hidden />
      <div className="toggle-switch-dot dot" aria-hidden />
      <span className={`toggle-switch-label ${labelClassName}`.trim()}>{label}</span>
    </label>
  );
}

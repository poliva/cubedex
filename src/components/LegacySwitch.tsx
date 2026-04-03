import type { ReactNode } from 'react';

type LegacySwitchProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  className?: string;
  labelClassName?: string;
};

export function LegacySwitch({
  id,
  checked,
  onChange,
  disabled,
  label,
  className = '',
  labelClassName = '',
}: LegacySwitchProps) {
  return (
    <label htmlFor={id} className={`legacy-switch ${className}`.trim()}>
      <input
        type="checkbox"
        id={id}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="legacy-switch-track" aria-hidden />
      <div className="legacy-switch-dot dot" aria-hidden />
      <span className={`legacy-switch-label ${labelClassName}`.trim()}>{label}</span>
    </label>
  );
}

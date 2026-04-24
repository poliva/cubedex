import type { CSSProperties, ReactNode } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
}

export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  id,
  style,
  labelStyle,
}: ToggleProps) {
  const w = 30;
  const h = 17;
  const dot = 13;

  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        minHeight: 44,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span
        style={{
          position: 'relative',
          width: w,
          height: h,
          flexShrink: 0,
          background: checked ? 'var(--accent)' : 'var(--border)',
          borderRadius: 99,
          transition: 'background 0.2s',
          display: 'block',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: (h - dot) / 2,
            left: checked ? w - dot - 2 : 2,
            width: dot,
            height: dot,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 1px 4px oklch(0% 0 0 / 0.3)',
            transition: 'left 0.2s',
          }}
        />
        <input
          id={id}
          type="checkbox"
          aria-label={ariaLabel}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
      </span>
      {label ? (
        <span style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.3, ...labelStyle }}>
          {label}
        </span>
      ) : null}
    </label>
  );
}

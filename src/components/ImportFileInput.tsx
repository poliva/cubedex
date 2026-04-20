import { memo, type ChangeEventHandler } from 'react';

interface ImportFileInputProps {
  id: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

export const ImportFileInput = memo(function ImportFileInput({ id, onChange }: ImportFileInputProps) {
  return (
    <input
      type="file"
      id={id}
      className="hidden"
      onChange={onChange}
    />
  );
});

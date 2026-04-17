import { memo, type ChangeEventHandler } from 'react';

interface ImportFileInputProps {
  onChange: ChangeEventHandler<HTMLInputElement>;
}

export const ImportFileInput = memo(function ImportFileInput({ onChange }: ImportFileInputProps) {
  return (
    <input
      type="file"
      id="import-file"
      className="hidden"
      onChange={onChange}
    />
  );
});

import type { ZipEntry } from '../hooks/useBook';

interface ZipPickerProps {
  entries: ZipEntry[];
  onPick: (name: string) => void;
  onCancel: () => void;
}

export function ZipPicker({ entries, onPick, onCancel }: ZipPickerProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Выберите книгу из архива</div>
        <ul className="modal-list">
          {entries.map(e => (
            <li key={e.name}>
              <button className="modal-item" onClick={() => onPick(e.name)}>
                {e.name}
              </button>
            </li>
          ))}
        </ul>
        <button className="modal-cancel" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
import {
  type RsvpConfig,
  type RsvpHighlight,
  MIN_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
  CHUNK_SIZE_STEP,
  MIN_FONT_SCALE,
  MAX_FONT_SCALE,
  FONT_SCALE_STEP,
} from '../config';

interface RsvpSettingsProps {
  config: RsvpConfig;
  onChange: (patch: Partial<RsvpConfig>) => void;
}

const CHUNK_PRESETS = [10, 35, 50, 70];
const HIGHLIGHTS: { value: RsvpHighlight; label: string; tip: string }[] = [
  { value: 'none', label: '—', tip: 'Без выделения' },
  { value: 'orp', label: 'ORP', tip: 'Фокусная буква по центру' },
  { value: 'orp-plus', label: 'ORP+', tip: 'Средняя буква каждого слова красным' },
  { value: 'bionic', label: 'Bionic', tip: 'Жирные начала слов' },
  { value: 'creep', label: 'Creep', tip: 'Подсветка ползёт по тексту без оверлея' },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function RsvpSettings({ config, onChange }: RsvpSettingsProps) {
  const chunkMinus = () =>
    onChange({ chunkSize: clamp(config.chunkSize - CHUNK_SIZE_STEP, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE) });
  const chunkPlus = () =>
    onChange({ chunkSize: clamp(config.chunkSize + CHUNK_SIZE_STEP, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE) });

  const fontMinus = () =>
    onChange({ fontScale: +clamp(config.fontScale - FONT_SCALE_STEP, MIN_FONT_SCALE, MAX_FONT_SCALE).toFixed(2) });
  const fontPlus = () =>
    onChange({ fontScale: +clamp(config.fontScale + FONT_SCALE_STEP, MIN_FONT_SCALE, MAX_FONT_SCALE).toFixed(2) });

  return (
    <div className="rsvp-settings">
      <div className="settings-title">Скорочтение</div>

      <div className="settings-row">
        <span className="settings-label">Блок</span>
        <span className="settings-value">{config.chunkSize} симв.</span>
      </div>
      <div className="chip-row">
        <button
          className="chip"
          onClick={chunkMinus}
          disabled={config.chunkSize <= MIN_CHUNK_SIZE}
          title="−2"
        >
          −2
        </button>
        {CHUNK_PRESETS.map(n => (
          <button
            key={n}
            className={'chip' + (config.chunkSize === n ? ' active' : '')}
            onClick={() => onChange({ chunkSize: n })}
          >
            {n}
          </button>
        ))}
        <button
          className="chip"
          onClick={chunkPlus}
          disabled={config.chunkSize >= MAX_CHUNK_SIZE}
          title="+2"
        >
          +2
        </button>
      </div>

      <div className="settings-row">
        <span className="settings-label">Шрифт</span>
        <span className="settings-value">{Math.round(config.fontScale * 100)}%</span>
      </div>
      <div className="chip-row">
        <button
          className="chip"
          onClick={fontMinus}
          disabled={config.fontScale <= MIN_FONT_SCALE}
          title="−5%"
        >
          −5%
        </button>
        <button
          className="chip"
          onClick={() => onChange({ fontScale: 1 })}
          disabled={config.fontScale === 1}
          title="Сбросить до 100%"
        >
          100%
        </button>
        <button
          className="chip"
          onClick={fontPlus}
          disabled={config.fontScale >= MAX_FONT_SCALE}
          title="+5%"
        >
          +5%
        </button>
      </div>

      <div className="settings-row">
        <span className="settings-label">Выделение</span>
      </div>
      <div className="chip-row">
        {HIGHLIGHTS.map(h => (
          <button
            key={h.value}
            className={'chip' + (config.highlight === h.value ? ' active' : '')}
            title={h.tip}
            onClick={() => onChange({ highlight: h.value })}
          >
            {h.label}
          </button>
        ))}
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={config.pauseOnPunctuation}
          onChange={e => onChange({ pauseOnPunctuation: e.target.checked })}
        />
        <span>Паузы на пунктуации</span>
      </label>
    </div>
  );
}
import { useEffect, useState } from 'react';

interface SpeedControlProps {
  charsPerMin: number;
  onAdjust: (delta: number) => void;
}

export function SpeedControl({ charsPerMin, onAdjust }: SpeedControlProps) {
  const [step, setStep] = useState(500);

  useEffect(() => {
    const update = (e: KeyboardEvent) => {
      if (e.shiftKey) setStep(100);
      else if (e.ctrlKey || e.metaKey) setStep(1000);
      else setStep(500);
    };
    const onKeyDown = (e: KeyboardEvent) => update(e);
    const onKeyUp = (e: KeyboardEvent) => update(e);
    const onBlur = () => setStep(500);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <div className="speed-control">
      <button
        onClick={() => onAdjust(-step)}
        title="Клик: ±500 · Shift: ±100 · Ctrl: ±1000"
      >
        −{step}
      </button>
      <span className="speed-value">{charsPerMin} зн/мин</span>
      <button
        onClick={() => onAdjust(+step)}
        title="Клик: ±500 · Shift: ±100 · Ctrl: ±1000"
      >
        +{step}
      </button>
    </div>
  );
}
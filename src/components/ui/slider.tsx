import { cn } from "@/utils/cn";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

function Slider({ value, min = 0, max = 100, step = 1, onChange, className, disabled }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "w-full h-2 appearance-none rounded-full bg-secondary cursor-pointer",
        "accent-primary disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    />
  );
}

export { Slider };

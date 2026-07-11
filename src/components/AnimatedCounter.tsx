import { useState, useEffect } from "react";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  duration?: number;
}

export default function AnimatedCounter({ value, prefix = "₹", duration = 800 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function: cubic ease-out
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const current = startValue + easeProgress * (endValue - startValue);
      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span className="font-display font-bold tracking-tight text-amber-400">
      {prefix}
      {displayValue.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

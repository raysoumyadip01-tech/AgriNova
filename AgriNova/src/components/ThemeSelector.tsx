import { Coffee, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { ThemeMode } from '../types/auth';

interface ThemeSelectorProps {
  onSelect?: (mode: ThemeMode) => void;
  compact?: boolean;
}

export function ThemeSelector({ onSelect, compact = false }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();

  const options: Array<{ mode: ThemeMode; label: string; Icon: typeof Sun }> = [
    { mode: 'coffee', label: 'Coffee', Icon: Coffee },
    { mode: 'light', label: 'Light', Icon: Sun },
    { mode: 'dark', label: 'Dark', Icon: Moon },
    { mode: 'system', label: 'Auto', Icon: Monitor },
  ];

  const handleClick = (mode: ThemeMode) => {
    setTheme(mode);
    onSelect?.(mode);
  };

  return (
    <div
      role="group"
      aria-label="Theme preference"
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/80"
    >
      {options.map(({ mode, label, Icon }) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleClick(mode)}
            aria-pressed={active}
            title={`${label} theme`}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#0F172A] dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

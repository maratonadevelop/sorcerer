import React, { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  // Optional: custom aria-label if label is shortened visually
  ariaLabel?: string;
}

interface FilterBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  // When true, reduces padding/font slightly
  compact?: boolean;
  // Optional: provide an element (e.g. a search input) to render before the options
  leading?: React.ReactNode;
  // Optional: provide an element to render after the options (e.g. extra actions)
  trailing?: React.ReactNode;
  // If you want the bar to wrap vs overflow scroll
  wrap?: boolean;
}

/**
 * FilterBar
 * A reusable horizontal category selector that mirrors the aesthetic of the Codex Tabs.
 * Accessible (role=tablist / tab) + keyboard left/right navigation.
 */
export function FilterBar({
  options,
  value,
  onChange,
  className,
  compact,
  leading,
  trailing,
  wrap,
}: FilterBarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const newIndex = (idx + dir + options.length) % options.length;
    const newVal = options[newIndex].value;
    onChange(newVal);
    // focus new button
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
    buttons?.[newIndex]?.focus();
  }, [options, onChange]);

  return (
    <div
      className={cn(
        'filter-bar relative flex items-stretch gap-3 rounded-xl bg-card/40 backdrop-blur-sm border border-primary/60 ring-2 ring-primary/50 px-4 py-3',
        wrap ? 'flex-wrap' : 'overflow-x-auto scrollbar-thin',
        className,
      )}
      role="tablist"
      aria-orientation="horizontal"
      ref={containerRef}
    >
      {leading && <div className="shrink-0 flex items-center mr-2">{leading}</div>}
      <div className={cn('flex items-center gap-2', wrap ? 'flex-wrap' : 'flex-nowrap')}> 
        {options.map((opt, i) => {
          const active = value === opt.value;
          const dimmed = value && !active;
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={active}
              aria-label={opt.ariaLabel || opt.label}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => handleKey(e, i)}
              data-active={active ? 'true' : 'false'}
              className={cn(
                'group relative whitespace-nowrap rounded-sm text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:#e6cfa3] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex items-center gap-2 px-3',
                compact ? 'h-8 py-1' : 'h-9 py-1.5',
                active ? 'text-[color:#071522]' : 'text-muted-foreground',
              )}
              style={active ? {
                background: 'rgba(230,205,150,0.95)',
                boxShadow: '0 8px 22px rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.04)',
                transform: 'scale(1.02)'
              } : {
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                opacity: dimmed ? 0.45 : 0.92,
                transform: dimmed ? 'scale(0.985)' : 'scale(1)'
              }}
            >
              {opt.icon && <span className="h-4 w-4 flex items-center justify-center transition-colors duration-300">{opt.icon}</span>}
              <span className="transition-colors duration-300">{opt.label}</span>
              {!active && (
                <span className="pointer-events-none absolute inset-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.12))' }} />
              )}
            </button>
          );
        })}
      </div>
      {trailing && <div className="shrink-0 flex items-center ml-2">{trailing}</div>}
    </div>
  );
}

export default FilterBar;

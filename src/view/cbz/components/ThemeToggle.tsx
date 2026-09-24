import { useCbzTheme } from '../../../model/cbz/theme';

// Segmented pill so the current theme is always visible — better UX than a
// generic sun/moon icon, especially when the underlying palette is changing.
export function ThemeToggle({ variant = 'topbar' }: { variant?: 'topbar' | 'nav' }) {
  const { theme, setTheme } = useCbzTheme();
  return (
    <div className={`cbz-theme-toggle cbz-theme-toggle--${variant}`} role="group" aria-label="Theme">
      <button
        type="button"
        className={`cbz-theme-toggle__opt ${theme === 'light' ? 'is-active' : ''}`}
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
      >
        <SunIcon />
        <span>Light</span>
      </button>
      <button
        type="button"
        className={`cbz-theme-toggle__opt ${theme === 'dark' ? 'is-active' : ''}`}
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
      >
        <MoonIcon />
        <span>Dark</span>
      </button>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

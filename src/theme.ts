// Light / dark / system theme. The choice is saved with the other preferences (store.ts);
// index.html applies it before first paint, and useApplyTheme keeps it applied afterwards.
import { useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useApplyTheme(theme: Theme) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply); // follow the OS while on "System"
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

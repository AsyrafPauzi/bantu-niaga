/**
 * Theme primitives shared by the provider, the SSR no-flash script, and the
 * `/settings/appearance` UI.
 *
 * v1 stores the preference in `localStorage` under `THEME_STORAGE_KEY`. A
 * future iteration is expected to mirror this into a `user_preferences` table
 * (Supabase) so the theme follows the user across devices — see the README /
 * settings page for the upgrade path.
 */

export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "bantuniaga.theme";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

/** Mobile PWA shell: phone layouts (< 768px). */
export const MOBILE_MAX_PX = 767;

/** Tablet uses desktop shell with collapsed sidebar default (768–1023px). */
export const TABLET_MIN_PX = 768;

/** Wide desktop layout tweaks (≥ 1024px). */
export const DESKTOP_MIN_PX = 1024;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_PX}px)`;

export const TABLET_MEDIA_QUERY = `(min-width: ${TABLET_MIN_PX}px) and (max-width: ${DESKTOP_MIN_PX - 1}px)`;

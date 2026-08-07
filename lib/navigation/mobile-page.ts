/** Standard bottom padding for pages inside the mobile shell (above tab bar). */
export const MOBILE_PAGE_BOTTOM =
  "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8";

/** Wrapper for module overview pages on mobile + desktop. */
export const MOBILE_PAGE_SHELL = `space-y-4 ${MOBILE_PAGE_BOTTOM}`;

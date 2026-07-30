/** Full-height chat layout (inner message list scrolls, not the page shell). */
export function isAssistantChatRoute(pathname: string): boolean {
  return pathname.endsWith("/assistant");
}

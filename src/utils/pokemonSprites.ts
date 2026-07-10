export function isFullShowdownSpriteUrl(url: string | undefined) {
  return Boolean(url?.includes("/sprites/home/") || url?.includes("/sprites/home-centered/"));
}

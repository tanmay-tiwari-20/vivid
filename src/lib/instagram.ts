export function getInstagramReel(source: string): { url: string; embed: string } | null {
  try {
    const parsed = new URL(source.trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return null;
    if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(parsed.hostname)) return null;
    const match = /^\/(reel|reels|p|tv)\/([a-zA-Z0-9_-]{1,100})\/?$/.exec(parsed.pathname);
    if (!match) return null;
    const kind = match[1] === 'reels' ? 'reel' : match[1];
    const url = `https://www.instagram.com/${kind}/${match[2]}/`;
    return { url, embed: `${url}embed/` };
  } catch {
    return null;
  }
}

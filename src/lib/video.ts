// Parse user-linked demonstration videos from trusted providers.
export type VideoSource =
  | { kind: 'youtube'; id: string; embed: string }
  | { kind: 'vimeo'; id: string; embed: string }
  | { kind: 'file'; src: string };

export function parseVideoUrl(raw: string): VideoSource | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let id = url.searchParams.get('v');
    const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
    if (!id && m) id = m[1];
    if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'youtube', id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` };
    return null;
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[\w-]{6,}$/.test(id) ? { kind: 'youtube', id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = url.pathname.match(/(\d{5,})/);
    return m ? { kind: 'vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}` } : null;
  }
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return { kind: 'file', src: url.toString() };
  return null;
}

/** Search link on YouTube for a technique demonstration (always resolves to real results). */
export function youtubeSearchUrl(nameEn: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nameEn} exercise proper form`)}`;
}

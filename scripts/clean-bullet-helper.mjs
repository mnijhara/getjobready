export function cleanBullet(text) {
  if (!text) return '';
  return text.replace(/^[•▪*-]\s*/, '').replace(/\s+/g, ' ').trim();
}

export function truncateAtWord(str, maxLen) {
  if (!str) return '';
  let clean = str.replace(/[ \t]+/g, ' ').trim();
  if (clean.length <= maxLen) return cleanBullet(clean);
  const sub = clean.slice(0, maxLen);
  const lastSpace = sub.lastIndexOf(' ');
  const cut = (lastSpace > Math.floor(maxLen * 0.55)) ? sub.slice(0, lastSpace) : sub;
  return cleanBullet(cut);
}

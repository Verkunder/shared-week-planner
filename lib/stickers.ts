// Twemoji-backed sticker pack. We send the emoji codepoint as the message
// attachment and render it through the jsdelivr-hosted Twemoji CDN so the
// same image is shown on every device, regardless of native emoji font.

export const STICKER_PACK: string[] = [
  // smiles
  "😀", "😁", "😂", "🤣", "😅", "😆", "😉", "😊", "😇",
  "🙂", "😍", "😘", "😜", "🤪", "😎", "🤓", "🥳", "🤩",
  // sad / concerned
  "😢", "😭", "😞", "😔", "🙁", "😣", "😖", "😡", "🤬",
  "🥺", "😱", "😰",
  // thinking / sleepy / quiet
  "🤔", "🤗", "😴", "😪", "🥱", "🤐", "🤫", "🤨",
  // hands
  "👍", "👎", "👏", "🙌", "👋", "🤝", "💪", "🤞",
  // hearts
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔",
  // animals
  "🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐸", "🦄",
  // misc
  "🔥", "✨", "⭐", "💯", "🎉", "🎂", "🎁", "👀", "🚀",
];

const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets";

export function twemojiUrl(emoji: string, size: 72 | 16 = 72): string {
  const codepoints: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === 0xfe0f) continue;
    codepoints.push(cp.toString(16));
  }
  const code = codepoints.join("-");
  return `${TWEMOJI_BASE}/${size}x${size}/${code}.png`;
}

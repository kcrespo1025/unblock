export const STICKERS = [
  { name: 'party', emoji: '🎉' },
  { name: 'laugh', emoji: '😂' },
  { name: 'love', emoji: '❤️' },
  { name: 'fire', emoji: '🔥' },
  { name: 'hundred', emoji: '💯' },
  { name: 'clown', emoji: '🤡' },
  { name: 'crying', emoji: '😭' },
  { name: 'cool', emoji: '😎' },
  { name: 'thinking', emoji: '🤔' },
  { name: 'heart-eyes', emoji: '😍' },
  { name: 'angry', emoji: '😡' },
  { name: 'sick', emoji: '🤢' },
  { name: 'skull', emoji: '💀' },
  { name: 'robot', emoji: '🤖' },
  { name: 'alien', emoji: '👽' },
  { name: 'ghost', emoji: '👻' },
  { name: 'cat', emoji: '🐱' },
  { name: 'dog', emoji: '🐶' },
  { name: 'unicorn', emoji: '🦄' },
  { name: 'rocket', emoji: '🚀' },
  { name: 'star', emoji: '⭐' },
  { name: 'lightning', emoji: '⚡' },
  { name: 'snow', emoji: '❄️' },
  { name: 'coffee', emoji: '☕' },
  { name: 'pizza', emoji: '🍕' },
  { name: 'taco', emoji: '🌮' },
  { name: 'game', emoji: '🎮' },
  { name: 'music', emoji: '🎵' }
]

export function stickerByName(name) {
  return STICKERS.find((s) => s.name === name) || null
}

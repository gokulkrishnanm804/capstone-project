export const AVATAR_OPTIONS = [
  {
    id: "avatar-1",
    label: "SentinelPay Aura",
    filename: "sentinalpay - profile-image-1.avif",
  },
  {
    id: "avatar-2",
    label: "SentinelPay Duo",
    filename: "sentinalpay - profile-image-2.avif",
  },
  {
    id: "avatar-3",
    label: "SentinelPay Crest",
    filename: "sentinalpay - profile-image-3.jpg",
  },
];

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0].filename;

export function getAvatarUrl(filename = DEFAULT_AVATAR) {
  const safeName = filename || DEFAULT_AVATAR;
  return `/${encodeURIComponent(safeName)}`;
}

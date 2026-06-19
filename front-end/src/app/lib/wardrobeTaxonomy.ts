export const CANONICAL_CLOTHING_CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "intimates",
] as const;

export type CanonicalClothingCategory = (typeof CANONICAL_CLOTHING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CanonicalClothingCategory, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outerwear: "Outerwear",
  shoes: "Shoes",
  bag: "Bag",
  intimates: "Intimates",
};

const CATEGORY_ALIASES: Record<string, CanonicalClothingCategory> = {
  top: "top",
  shirt: "top",
  "t-shirt": "top",
  tshirt: "top",
  tee: "top",
  sweater: "top",
  sweatshirt: "top",
  "tank top": "top",
  tank: "top",
  blouse: "top",
  hoodie: "top",
  cardigan: "top",
  camisole: "top",
  cami: "top",
  vest: "top",
  bottom: "bottom",
  bottoms: "bottom",
  pants: "bottom",
  shorts: "bottom",
  short: "bottom",
  skirt: "bottom",
  jeans: "bottom",
  dress: "dress",
  outerwear: "outerwear",
  jacket: "outerwear",
  coat: "outerwear",
  blazer: "outerwear",
  peacoat: "outerwear",
  shoes: "shoes",
  shoe: "shoes",
  boots: "shoes",
  boot: "shoes",
  sandals: "shoes",
  sandal: "shoes",
  flats: "shoes",
  flat: "shoes",
  sneakers: "shoes",
  sneaker: "shoes",
  heels: "shoes",
  heel: "shoes",
  pumps: "shoes",
  slippers: "shoes",
  bag: "bag",
  bags: "bag",
  handbag: "bag",
  tote: "bag",
  crossbody: "bag",
  "shoulder bag": "bag",
  intimates: "intimates",
  intimate: "intimates",
  bra: "intimates",
  bralette: "intimates",
  bikini: "intimates",
  swimwear: "intimates",
  lingerie: "intimates",
  underwear: "intimates",
};

export const CATEGORY_LIKE_TAGS = new Set([
  "top",
  "bottom",
  "bottoms",
  "dress",
  "outerwear",
  "shoes",
  "shoe",
  "bag",
  "bags",
  "intimates",
  "intimate",
]);

export function normalizeCategory(value: unknown): CanonicalClothingCategory | "" {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return CATEGORY_ALIASES[normalized] ?? "";
}

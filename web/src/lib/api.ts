export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(e.message || 'Request failed');
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export type Variant = {
  id: string;
  name: string;
  sku?: string | null;
  price?: string | null;
  stockQuantity: number;
  isActive: boolean;
};

export type Review = {
  id: string;
  rating: number;
  body?: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  shortDescription?: string | null;
  description?: string | null;
  price: string;
  compareAtPrice?: string | null;
  costPrice?: string | null;
  marketPrice?: string | null;
  bundleItems?: { productId: string; qty: number }[] | null;
  stockQuantity: number;
  weightGrams?: number | null;
  isFeatured?: boolean;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  images: { id?: string; url: string; alt?: string | null; sortOrder?: number }[];
  videos?: { id: string; kind: 'upload' | 'embed'; url: string; thumbnailUrl?: string | null; sortOrder: number }[];
  category: { id?: string; name: string; slug: string };
  variants?: Variant[];
  reviews?: Review[];
};

/** Price shown for a product/variant pair — variant price overrides when set. */
export const effectivePrice = (
  p: { price: string },
  v?: { price?: string | null } | null,
): number => Number(v && v.price !== null && v.price !== undefined ? v.price : p.price);

export const money = (n: number): string => `PKR ${n.toLocaleString('en-PK')}`;

export const averageRating = (reviews?: Review[]): number | null => {
  if (!reviews || reviews.length === 0) return null;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
};

interface CachedContact {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const contactCache = new Map<string, CachedContact>();

export const contactCacheService = {
  set(contactId: string, data: any) {
    contactCache.set(contactId, {
      data,
      timestamp: Date.now(),
    });
  },

  get(contactId: string) {
    const cached = contactCache.get(contactId);
    if (!cached) return null;

    // Check if cache has expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      contactCache.delete(contactId);
      return null;
    }

    return cached.data;
  },

  clear() {
    contactCache.clear();
  },
};
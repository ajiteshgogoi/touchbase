export interface SanityImage {
  _type: 'image';
  asset: {
    _ref: string;
    _type: 'reference';
  };
}

export interface Author {
  name: string;
  image?: SanityImage;
}

export interface Post {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  mainImage?: SanityImage;
  publishedAt: string;
  excerpt?: string;
  body?: any; // This will be Portable Text
  categories?: string[];
  author?: Author;
  // SEO fields
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogImage?: SanityImage;
  ogTitle?: string;
  ogDescription?: string;
}

export interface PostListItem {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  mainImage?: SanityImage;
  publishedAt: string;
  excerpt?: string;
  categories?: string[];
}
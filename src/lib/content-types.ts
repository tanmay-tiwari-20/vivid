export type Reel = {
  id: string;
  title: string;
  brand: string;
  brandId: string;
  creator: string;
  creatorId: string;
  category: string;
  description: string;
  image: string;
  video: string;
  views: string;
  reach: string;
  color: string;
  featured: boolean;
  published: boolean;
  demo: boolean;
};

export type Creator = {
  id: string;
  name: string;
  category: string;
  specialty: string;
  bio: string;
  image: string;
  profileUrl: string;
  handle: string;
  followers: string;
  featured: boolean;
  published: boolean;
  demo: boolean;
};

export type Brand = {
  id: string;
  name: string;
  category: string;
  description: string;
  logo: string;
  websiteUrl: string;
  published: boolean;
  demo: boolean;
};

export type SiteContent = {
  reels: Reel[];
  creators: Creator[];
  brands: Brand[];
  revision: string;
};

import type { Brand, SiteContent } from './content-types';

export const initialBrands: Brand[] = [
  { id: 'boat', name: 'boAt', category: 'AUDIO & LIFESTYLE', description: '', logo: '', websiteUrl: '', published: true, demo: true },
  { id: 'puma', name: 'PUMA', category: 'SPORT & FITNESS', description: '', logo: '', websiteUrl: '', published: true, demo: true },
  { id: 'nykaa', name: 'Nykaa', category: 'BEAUTY & WELLNESS', description: '', logo: '', websiteUrl: '', published: true, demo: true },
  { id: 'spotify', name: 'Spotify', category: 'MUSIC & CULTURE', description: '', logo: '', websiteUrl: '', published: true, demo: true },
  { id: 'myntra', name: 'Myntra', category: 'FASHION & LIFESTYLE', description: '', logo: '', websiteUrl: '', published: true, demo: true },
  { id: 'swiggy', name: 'Swiggy', category: 'FOOD & EVERYDAY LIFE', description: '', logo: '', websiteUrl: '', published: true, demo: true },
];

export const initialContent: SiteContent = {
  revision: 'initial',
  brands: initialBrands,
  creators: [
    { id: 'meera', name: 'Meera Sethi', category: 'FASHION & SELF-EXPRESSION', image: '/images/creator-fashion.jpg', specialty: 'A style all her own.', bio: 'Fashion, personality, and a fresh perspective on self-expression.', profileUrl: '', handle: '', followers: '', featured: true, published: true, demo: true },
    { id: 'rohan', name: 'Rohan Sen', category: 'LIFESTYLE & CULTURE', image: '/images/creator-lifestyle.jpg', specialty: 'Everyday, reimagined.', bio: 'Finding stories in the city, everyday culture, and the moments in between.', profileUrl: '', handle: '', followers: '', featured: true, published: true, demo: true },
    { id: 'ishaan', name: 'Ishaan Rao', category: 'FITNESS & MOVEMENT', image: '/images/creator-fitness.jpg', specialty: 'Energy that moves you.', bio: 'Movement, motivation, and a community built around showing up.', profileUrl: '', handle: '', followers: '', featured: true, published: true, demo: true },
    { id: 'anaya', name: 'Anaya Mehra', category: 'BEAUTY & WELLNESS', image: '/images/creator-beauty.jpg', specialty: 'Confidence, on camera.', bio: 'Personal beauty rituals and everyday confidence, shared with an honest point of view.', profileUrl: '', handle: '', followers: '', featured: true, published: true, demo: true },
  ],
  reels: [
    { id: 'everyday', brand: 'Nykaa', brandId: 'nykaa', creator: 'Anaya Mehra', creatorId: 'anaya', category: 'BEAUTY & LIFESTYLE', title: 'A little everyday glow.', views: '3.1M', reach: '2.2M', image: '/images/creator-beauty.jpg', video: '/videos/beauty.mp4', color: '#e6f8f2', description: 'A getting-ready story that makes a daily ritual feel a little more special. Built around honest moments, personal expression, and a creator’s own point of view.', featured: true, published: true, demo: true },
    { id: 'city', brand: 'boAt', brandId: 'boat', creator: 'Rohan Sen', creatorId: 'rohan', category: 'MUSIC & CULTURE', title: 'Your city. Your soundtrack.', views: '2.4M', reach: '1.8M', image: '/images/creator-lifestyle.jpg', video: '/videos/lifestyle.mp4', color: '#e6f8f2', description: 'An everyday city adventure with a soundtrack of its own. A culture-led concept that brings a product into the moments an audience already cares about.', featured: true, published: true, demo: true },
    { id: 'movement', brand: 'PUMA', brandId: 'puma', creator: 'Ishaan Rao', creatorId: 'ishaan', category: 'FITNESS & MOVEMENT', title: 'Find your next gear.', views: '1.8M', reach: '1.2M', image: '/images/creator-fitness.jpg', video: '/videos/fitness.mp4', color: '#e6f8f2', description: 'From the first stretch to the last sprint. An energetic movement story about showing up for yourself, with the brand naturally part of the journey.', featured: true, published: true, demo: true },
    { id: 'style', brand: 'Myntra', brandId: 'myntra', creator: 'Meera Sethi', creatorId: 'meera', category: 'FASHION & SELF-EXPRESSION', title: 'Wear your own kind of bold.', views: '2.7M', reach: '1.9M', image: '/images/creator-fashion.jpg', video: '/videos/fashion.mp4', color: '#e6f8f2', description: 'One personality, a whole new perspective. A fashion concept that gives the creator room to make the style their own and invite their community into the story.', featured: true, published: true, demo: true },
    { id: 'moments', brand: 'Spotify', brandId: 'spotify', creator: 'Rohan Sen', creatorId: 'rohan', category: 'LIFESTYLE & DISCOVERY', title: 'A mood for every moment.', views: '1.6M', reach: '980K', image: '/images/creator-lifestyle.jpg', video: '/videos/lifestyle.mp4', color: '#e6f8f2', description: 'Small daily moments become a story worth sharing. A music-led concept that connects personal routines with the joy of discovering something new.', featured: false, published: true, demo: true },
  ],
};

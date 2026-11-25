import type { Brand, SiteContent } from './content-types';

export const initialBrands: Brand[] = [
  { id: 'masai', name: 'Masai', category: 'EDUCATION & UPSKILLING', description: '', logo: '/images/brands/masai.png', websiteUrl: 'https://www.masaischool.com', published: true, demo: false },
  { id: 'upgrad', name: 'upGrad', category: 'EDUCATION & UPSKILLING', description: '', logo: '/images/brands/upgrad.png', websiteUrl: 'https://www.upgrad.com/dba-from-golden-gate-university/', published: true, demo: false },
  { id: 'futurense', name: 'Futurense', category: 'EDUCATION & UPSKILLING', description: '', logo: '/images/brands/futurense.png', websiteUrl: 'https://www.futurense.com', published: true, demo: false },
  { id: 'naukri', name: 'Naukri', category: 'CAREERS & RECRUITMENT', description: '', logo: '/images/brands/naukri.png', websiteUrl: 'https://www.naukri.com/registration/createAccount', published: true, demo: false },
  { id: 'pw', name: 'PW', category: 'EDUCATION & LEARNING', description: '', logo: '/images/brands/pw.png', websiteUrl: 'https://www.pw.live', published: true, demo: false },
  { id: 'acadally-ai', name: 'Acadally AI', category: 'AI & EDUCATION', description: '', logo: '/images/brands/acadally-ai.png', websiteUrl: 'https://acadally.ai', published: true, demo: false },
  { id: 'iqoo', name: 'iQOO', category: 'SMARTPHONES & TECHNOLOGY', description: '', logo: '/images/brands/iqoo.png', websiteUrl: 'https://www.iqoo.com/in', published: true, demo: false },
  { id: 'scaler', name: 'Scaler', category: 'EDUCATION & UPSKILLING', description: '', logo: '/images/brands/scaler.png', websiteUrl: 'https://www.scaler.com', published: true, demo: false },
  { id: 'emergent-ai', name: 'Emergent AI', category: 'AI & SOFTWARE', description: '', logo: '/images/brands/emergent-ai.png', websiteUrl: 'https://app.emergent.sh/landing/', published: true, demo: false },
  { id: 'euron-plus', name: 'Euron Plus', category: 'EDUCATION & UPSKILLING', description: '', logo: '/images/brands/euron-plus.png', websiteUrl: 'https://euron.one/plus', published: true, demo: false },
  { id: 'newton-school', name: 'Newton School', category: 'TECHNOLOGY & EDUCATION', description: '', logo: '/images/brands/newton-school.png', websiteUrl: 'https://www.newtonschool.co/newton-school-of-technology-nst/home', published: true, demo: false },
  { id: 'codex', name: 'Codex', category: 'AI & SOFTWARE', description: '', logo: '/images/brands/codex.png', websiteUrl: 'https://openai.com/codex/', published: true, demo: false },
  { id: 'woxsen', name: 'Woxsen', category: 'HIGHER EDUCATION', description: '', logo: '/images/brands/woxsen.png', websiteUrl: 'https://woxsen.edu.in', published: true, demo: false },
  { id: 'emversity', name: 'Emversity', category: 'EDUCATION & CAREERS', description: '', logo: '/images/brands/emversity.png', websiteUrl: 'https://emversity.com', published: true, demo: false },
  { id: 'buniyaadplus', name: 'Buniyaadplus', category: 'EDUCATION & LEARNING', description: '', logo: '/images/brands/buniyaadplus.png', websiteUrl: 'https://www.buniyaadplus.live', published: true, demo: false },
  { id: 'bosscoder', name: 'Bosscoder', category: 'TECHNOLOGY & UPSKILLING', description: '', logo: '/images/brands/bosscoder.png', websiteUrl: 'https://www.bosscoderacademy.com', published: true, demo: false },
  { id: 'geeksforgeeks', name: 'GeeksforGeeks', category: 'TECHNOLOGY & EDUCATION', description: '', logo: '/images/brands/geeksforgeeks.png', websiteUrl: 'https://www.geeksforgeeks.org', published: true, demo: false },
  { id: 'final-round-ai', name: 'Final Round AI', category: 'AI & CAREERS', description: '', logo: '/images/brands/final-round-ai.png', websiteUrl: 'https://www.finalroundai.com', published: true, demo: false },
  { id: 'naresh-it', name: 'Naresh IT', category: 'TECHNOLOGY & TRAINING', description: '', logo: '/images/brands/naresh-it.png', websiteUrl: 'https://nareshit.in/artificial-intelligence-training/', published: true, demo: false },
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
    { id: 'everyday', brand: 'Nykaa', brandId: '', creator: 'Anaya Mehra', creatorId: 'anaya', category: 'BEAUTY & LIFESTYLE', title: 'A little everyday glow.', views: '3.1M', reach: '2.2M', image: '/images/creator-beauty.jpg', video: '/videos/beauty.mp4', color: '#e6f8f2', description: 'A getting-ready story that makes a daily ritual feel a little more special. Built around honest moments, personal expression, and a creator’s own point of view.', featured: true, published: true, demo: true },
    { id: 'city', brand: 'boAt', brandId: '', creator: 'Rohan Sen', creatorId: 'rohan', category: 'MUSIC & CULTURE', title: 'Your city. Your soundtrack.', views: '2.4M', reach: '1.8M', image: '/images/creator-lifestyle.jpg', video: '/videos/lifestyle.mp4', color: '#e6f8f2', description: 'An everyday city adventure with a soundtrack of its own. A culture-led concept that brings a product into the moments an audience already cares about.', featured: true, published: true, demo: true },
    { id: 'movement', brand: 'PUMA', brandId: '', creator: 'Ishaan Rao', creatorId: 'ishaan', category: 'FITNESS & MOVEMENT', title: 'Find your next gear.', views: '1.8M', reach: '1.2M', image: '/images/creator-fitness.jpg', video: '/videos/fitness.mp4', color: '#e6f8f2', description: 'From the first stretch to the last sprint. An energetic movement story about showing up for yourself, with the brand naturally part of the journey.', featured: true, published: true, demo: true },
    { id: 'style', brand: 'Myntra', brandId: '', creator: 'Meera Sethi', creatorId: 'meera', category: 'FASHION & SELF-EXPRESSION', title: 'Wear your own kind of bold.', views: '2.7M', reach: '1.9M', image: '/images/creator-fashion.jpg', video: '/videos/fashion.mp4', color: '#e6f8f2', description: 'One personality, a whole new perspective. A fashion concept that gives the creator room to make the style their own and invite their community into the story.', featured: true, published: true, demo: true },
    { id: 'moments', brand: 'Spotify', brandId: '', creator: 'Rohan Sen', creatorId: 'rohan', category: 'LIFESTYLE & DISCOVERY', title: 'A mood for every moment.', views: '1.6M', reach: '980K', image: '/images/creator-lifestyle.jpg', video: '/videos/lifestyle.mp4', color: '#e6f8f2', description: 'Small daily moments become a story worth sharing. A music-led concept that connects personal routines with the joy of discovering something new.', featured: false, published: true, demo: true },
  ],
};

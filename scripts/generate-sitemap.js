import fs from 'fs';
import path from 'path';

const baseUrl = 'https://touchbase.site';
const publicPages = [
  {
    url: '/',
    changefreq: 'weekly',
    priority: 1.0
  },
  {
    url: '/login',
    changefreq: 'weekly',
    priority: 1.0
  },
  {
    url: '/privacy',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/terms',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/support',
    changefreq: 'monthly',
    priority: 0.8
  },
  // Feature pages
  {
    url: '/features/smart-contact-management',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/features/intelligent-reminders',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/features/personalized-suggestions',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/features/conversation-prompts',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/features/bulk-import-export',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/features/important-events',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/features/relationship-insights',
    changefreq: 'monthly',
    priority: 0.9
  }
];

const generateSitemap = () => {
  const today = new Date().toISOString().split('T')[0];
  
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  // Ensure public directory exists
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Write sitemap
  fs.writeFileSync(
    path.join(publicDir, 'sitemap.xml'),
    sitemapContent,
    'utf-8'
  );

  console.log('Sitemap generated successfully!');
};

generateSitemap();
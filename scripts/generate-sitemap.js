import fs from 'fs';
import path from 'path';
import { createClient } from '@sanity/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const baseUrl = 'https://touchbase.site';

// Initialize Sanity client
const client = createClient({
  projectId: process.env.VITE_SANITY_PROJECT_ID,
  dataset: process.env.VITE_SANITY_DATASET,
  useCdn: true,
  apiVersion: '2024-04-03',
});

// Fetch all blog posts from Sanity
async function getBlogPosts() {
  return client.fetch(`
    *[_type == "post"] {
      slug,
      _updatedAt
    }
  `);
}
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
  },
  // Alternative pages
  {
    url: '/alternatives/best-personal-crm',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-relationship-manager',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-contact-organizer',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-relationship-management-app',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/personal-crm-tool',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/contact-management-software',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/relationship-tracking-tool',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/networking-management-software',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-crm-for-friends',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-crm-for-personal-use',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-personal-relationship-crm',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/personal-crm-system',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-crm-for-personal-life',
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    url: '/alternatives/best-personal-crm-for-networking',
    changefreq: 'monthly',
    priority: 0.8
  },
  // Comparison pages
  {
    url: '/compare/monica-personal-crm-vs-touchbase',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/compare/dex-personal-crm-vs-touchbase',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/compare/clay-personal-crm-vs-touchbase',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/compare/cloze-personal-crm-vs-touchbase',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/compare/notion-personal-crm-vs-touchbase',
    changefreq: 'monthly',
    priority: 0.9
  },
  {
    url: '/compare/airtable-personal-crm-vs-touchbase',
    changefreq: 'monthly',
    priority: 0.9
  }
];

// Add blog to public pages
publicPages.push({
  url: '/blog',
  changefreq: 'daily',
  priority: 0.9
});

const generateSitemap = async () => {
  try {
    console.log('Fetching blog posts...');
    const blogPosts = await getBlogPosts();
    
    // Generate URLs for all pages including blog posts
    const allUrls = [
      // Static pages
      ...publicPages.map(page => ({
        loc: `${baseUrl}${page.url}`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: page.changefreq,
        priority: page.priority
      })),
      // Blog posts
      ...blogPosts.map(post => ({
        loc: `${baseUrl}/blog/${post.slug.current}`,
        lastmod: post._updatedAt.split('T')[0],
        changefreq: 'monthly',
        priority: 0.8
      }))
    ];

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
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
  } catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
  }
};

// Convert generateSitemap into an async IIFE
(async () => {
  await generateSitemap();
})();
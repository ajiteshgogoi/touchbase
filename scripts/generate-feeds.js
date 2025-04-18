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

// Fetch all blog posts from Sanity with full content
async function getBlogPosts() {
  return client.fetch(`
    *[_type == "post"] {
      title,
      slug,
      description,
      _createdAt,
      _updatedAt
    } | order(_createdAt desc)
  `);
}

// Helper function to generate RSS feed XML
function generateRSSFeed(items, title, description) {
  const rssItems = items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <guid>${item.link}</guid>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
    </item>
  `).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${title}</title>
    <link>${baseUrl}</link>
    <description>${description}</description>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feeds/${title.toLowerCase().replace(/\s+/g, '-')}.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;
}

// Main feed generation function
async function generateFeeds() {
  try {
    // Ensure feeds directory exists
    const feedsDir = path.resolve('public', 'feeds');
    if (!fs.existsSync(feedsDir)) {
      fs.mkdirSync(feedsDir, { recursive: true });
    }

    // Generate blog posts feed
    const blogPosts = await getBlogPosts();
    const blogItems = blogPosts.map(post => ({
      title: post.title,
      link: `${baseUrl}/blog/${post.slug.current}`,
      description: post.description || '',
      pubDate: post._createdAt
    }));
    
    fs.writeFileSync(
      path.join(feedsDir, 'blog.xml'),
      generateRSSFeed(blogItems, 'Touchbase Blog', 'Latest articles from Touchbase')
    );

    // Generate features feed
    const featureItems = [
      {
        title: 'Smart Contact Management',
        link: `${baseUrl}/features/smart-contact-management`,
        description: 'Efficiently manage your contacts with smart organization features',
        pubDate: new Date()
      },
      {
        title: 'Intelligent Reminders',
        link: `${baseUrl}/features/intelligent-reminders`,
        description: 'Never miss important connections with intelligent reminder system',
        pubDate: new Date()
      },
      // Add other features here
    ];

    fs.writeFileSync(
      path.join(feedsDir, 'features.xml'),
      generateRSSFeed(featureItems, 'Touchbase Features', 'Latest features from Touchbase')
    );

    // Generate alternatives feed
    const alternativeItems = [
      {
        title: 'Best Personal CRM Alternatives',
        link: `${baseUrl}/alternatives/best-personal-crm`,
        description: 'Compare the best personal CRM alternatives',
        pubDate: new Date()
      },
      // Add other alternatives here
    ];

    fs.writeFileSync(
      path.join(feedsDir, 'alternatives.xml'),
      generateRSSFeed(alternativeItems, 'Touchbase Alternatives', 'Personal CRM alternatives and comparisons')
    );

    // Generate comparisons feed
    const comparisonItems = [
      {
        title: 'Monica Personal CRM vs Touchbase',
        link: `${baseUrl}/compare/monica-personal-crm-vs-touchbase`,
        description: 'Detailed comparison between Monica Personal CRM and Touchbase',
        pubDate: new Date()
      },
      // Add other comparisons here
    ];

    fs.writeFileSync(
      path.join(feedsDir, 'comparisons.xml'),
      generateRSSFeed(comparisonItems, 'Touchbase Comparisons', 'Compare Touchbase with other personal CRM solutions')
    );

    console.log('RSS feeds generated successfully!');
  } catch (error) {
    console.error('Error generating RSS feeds:', error);
    process.exit(1);
  }
}

// Convert generateFeeds into an async IIFE
(async () => {
  await generateFeeds();
})();
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

// Define all public pages
const publicPages = [
  // Feature pages
  {
    url: '/features/smart-contact-management',
    title: 'Smart Contact Management',
    description: "Track and manage your relationships with custom closeness levels, detailed notes and smart organization. TouchBase helps you nurture meaningful connections."
  },
  {
    url: '/features/intelligent-reminders',
    title: 'Intelligent Reminders',
    description: "Never miss important connections with TouchBase's smart reminder system. Get timely notifications and intelligent rescheduling."
  },
  {
    url: '/features/personalized-suggestions',
    title: 'Personalized Suggestions',
    description: "Get thoughtful interaction suggestions tailored to each relationship. TouchBase's smart assistant helps you maintain more meaningful connections."
  },
  {
    url: '/features/conversation-prompts',
    title: 'Conversation Prompts',
    description: "Get thoughtful, meaningful conversation starters that spark deeper connections. TouchBase helps you have more engaging discussions with your loved ones."
  },
  {
    url: '/features/bulk-import-export',
    title: 'Bulk Import Export',
    description: "Easily import and export your contacts with TouchBase's bulk tools.Import from Google Contacts, CSV or VCF files and export all your data."
  },
  {
    url: '/features/important-events',
    title: 'Important Events',
    description: "Never miss important moments with TouchBase's event tracking. Keep track of birthdays, anniversaries and special occasions with smart reminders."
  },
  {
    url: '/features/ai-chat-assistant',
    title: 'AI Chat Assistant',
    description: "Meet Base, your personal CRM AI assistant. Manage your contacts and relationships with natural language commands."
  },
  {
    url: '/features/relationship-insights',
    title: 'Relationship Insights',
    description: "Gain deeper understanding of your relationships with TouchBase's AI-powered analytics. Get personalized insights and maintain healthier connections."
  },
  // Alternative pages
  {
    url: '/alternatives/best-personal-crm',
    title: 'Best Personal CRM',
    description: 'Compare the best personal CRM solutions'
  },
  {
    url: '/alternatives/best-relationship-manager',
    title: 'Best Relationship Manager',
    description: 'Find the best relationship management tools'
  },
  {
    url: '/alternatives/best-contact-organizer',
    title: 'Best Contact Organizer',
    description: 'Compare top contact organization solutions'
  },
  {
    url: '/alternatives/best-relationship-management-app',
    title: 'Best Relationship Management App',
    description: 'Discover the best apps for managing relationships'
  },
  {
    url: '/alternatives/personal-crm-tool',
    title: 'Personal CRM Tool',
    description: 'Learn about personal CRM tools and options'
  },
  {
    url: '/alternatives/contact-management-software',
    title: 'Contact Management Software',
    description: 'Compare contact management software solutions'
  },
  {
    url: '/alternatives/relationship-tracking-tool',
    title: 'Relationship Tracking Tool',
    description: 'Find the best tools for tracking relationships'
  },
  {
    url: '/alternatives/networking-management-software',
    title: 'Networking Management Software',
    description: 'Compare networking management software options'
  },
  {
    url: '/alternatives/best-crm-for-friends',
    title: 'Best CRM for Friends',
    description: 'Find the perfect CRM for managing friendships'
  },
  {
    url: '/alternatives/best-crm-for-personal-use',
    title: 'Best CRM for Personal Use',
    description: 'Compare CRMs designed for personal use'
  },
  {
    url: '/alternatives/best-personal-relationship-crm',
    title: 'Best Personal Relationship CRM',
    description: 'Discover the best CRMs for personal relationships'
  },
  {
    url: '/alternatives/personal-crm-system',
    title: 'Personal CRM System',
    description: 'Learn about personal CRM systems and options'
  },
  {
    url: '/alternatives/best-crm-for-personal-life',
    title: 'Best CRM for Personal Life',
    description: 'Find the ideal CRM for your personal life'
  },
  {
    url: '/alternatives/best-personal-crm-for-networking',
    title: 'Best Personal CRM for Networking',
    description: 'Compare CRMs optimized for networking'
  },
  // Comparison pages
  {
    url: '/compare/monica-personal-crm-vs-touchbase',
    title: 'Monica Personal CRM vs Touchbase',
    description: 'Detailed comparison between Monica Personal CRM and Touchbase'
  },
  {
    url: '/compare/dex-personal-crm-vs-touchbase',
    title: 'Dex Personal CRM vs Touchbase',
    description: 'Compare Dex Personal CRM with Touchbase'
  },
  {
    url: '/compare/clay-personal-crm-vs-touchbase',
    title: 'Clay Personal CRM vs Touchbase',
    description: 'Compare Clay Personal CRM with Touchbase'
  },
  {
    url: '/compare/cloze-personal-crm-vs-touchbase',
    title: 'Cloze Personal CRM vs Touchbase',
    description: 'Compare Cloze Personal CRM with Touchbase'
  },
  {
    url: '/compare/notion-personal-crm-vs-touchbase',
    title: 'Notion Personal CRM vs Touchbase',
    description: 'Compare Notion Personal CRM with Touchbase'
  },
  {
    url: '/compare/airtable-personal-crm-vs-touchbase',
    title: 'Airtable Personal CRM vs Touchbase',
    description: 'Compare Airtable Personal CRM with Touchbase'
  },
  {
    url: '/compare/free-vs-paid-personal-crm',
    title: 'Free vs Paid Personal CRM',
    description: 'Compare free and paid personal CRM options'
  }
];

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
    const featureItems = publicPages
      .filter(page => page.url.startsWith('/features/'))
      .map(page => ({
        title: page.title,
        link: `${baseUrl}${page.url}`,
        description: page.description,
        pubDate: new Date()
      }));

    fs.writeFileSync(
      path.join(feedsDir, 'features.xml'),
      generateRSSFeed(featureItems, 'Touchbase Features', 'Latest features from Touchbase')
    );

    // Generate alternatives feed
    const alternativeItems = publicPages
      .filter(page => page.url.startsWith('/alternatives/'))
      .map(page => ({
        title: page.title,
        link: `${baseUrl}${page.url}`,
        description: page.description,
        pubDate: new Date()
      }));

    fs.writeFileSync(
      path.join(feedsDir, 'alternatives.xml'),
      generateRSSFeed(alternativeItems, 'Touchbase Alternatives', 'Personal CRM alternatives and comparisons')
    );

    // Generate comparisons feed
    const comparisonItems = publicPages
      .filter(page => page.url.startsWith('/compare/'))
      .map(page => ({
        title: page.title,
        link: `${baseUrl}${page.url}`,
        description: page.description,
        pubDate: new Date()
      }));

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
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://designerslack.community';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'communities.json');

const LOCATION_SLUGS = [
  'apac', 'africa', 'australia', 'brazil', 'canada', 'chile',
  'finland', 'france', 'germany', 'global', 'india', 'italy',
  'japan', 'korea', 'midwest', 'portugal', 'russia', 'spain',
  'sweden', 'turkey', 'uk', 'us'
];

const TYPE_SLUGS = [
  'accessbility', 'animation', 'content', 'design-leaders',
  'design-ops', 'design-system', 'general', 'illustration',
  'minority-group', 'product', 'remote', 'service-design',
  'software', 'technology', 'typography', 'ux', 'user-research'
];

const TYPE_LABELS = {
  'accessbility': 'Accessbility',
  'animation': 'Animation',
  'content': 'Content',
  'design-leaders': 'Design Leaders',
  'design-ops': 'Design Ops',
  'design-system': 'Design System',
  'general': 'General',
  'illustration': 'Illustration',
  'minority-group': 'Minority Group',
  'product': 'Product',
  'remote': 'Remote Work',
  'service-design': 'Service Design',
  'software': 'Software',
  'technology': 'Technology',
  'typography': 'Typography',
  'ux': 'UX/UI',
  'user-research': 'User Research'
};

const LOCATION_LABELS = {
  'apac': 'APAC',
  'africa': 'Africa',
  'australia': 'Australia',
  'brazil': 'Brazil',
  'canada': 'Canada',
  'chile': 'Chile',
  'finland': 'Finland',
  'france': 'France',
  'germany': 'Germany',
  'global': 'Global',
  'india': 'India',
  'italy': 'Italy',
  'japan': 'Japan',
  'korea': 'Korea',
  'midwest': 'Midwest',
  'portugal': 'Portugal',
  'russia': 'Russia',
  'spain': 'Spain',
  'sweden': 'Sweden',
  'turkey': 'Turkey',
  'uk': 'UK',
  'us': 'USA'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DesignerSlackScraper/1.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getSitemapUrls() {
  console.log('Fetching sitemap...');
  const xml = await fetchPage(SITEMAP_URL);
  const result = await xml2js.parseStringPromise(xml);
  const urls = result.urlset.url.map(u => u.loc[0]);
  const communityUrls = urls.filter(u => u.includes('/community/') && !u.endsWith('rss.xml'));
  console.log(`Found ${communityUrls.length} community URLs in sitemap`);
  return communityUrls;
}

function scrapeCommunityPage($) {
  // Name: h2.text-2xl inside the card
  const name = $('h2.text-2xl').first().text().trim();

  // Description: p.text-base.card-description
  const description = $('p.text-base.card-description').first().text().trim();

  // Access type badge: div.badge (without .categ on detail pages)
  const badgeEl = $('.badge').first();
  const accessType = badgeEl.length ? badgeEl.text().trim().toLowerCase() : 'public';

  // Badge colors (inline styles)
  const badgeStyle = badgeEl.attr('style') || '';
  let badgeTextColor = '';
  let badgeBgColor = '';
  const colorMatch = badgeStyle.match(/color:\s*(hsla?\([^)]+\))/);
  const bgMatch = badgeStyle.match(/background-color:\s*(hsla?\([^)]+\))/);
  if (colorMatch) badgeTextColor = colorMatch[1];
  if (bgMatch) badgeBgColor = bgMatch[1];

  // Website URL: from a.title-link or a.small-join-link href
  const titleLink = $('a.title-link').first();
  const joinLink = $('a.small-join-link').first();
  const websiteUrl = (titleLink.attr('href') || joinLink.attr('href') || '').trim();

  // Social links: a.small-link (skip ones with w-condition-invisible or empty hrefs)
  let twitterUrl = '';
  let instagramUrl = '';
  $('a.small-link').each((_, el) => {
    const $el = $(el);
    // Skip hidden/empty links
    if ($el.hasClass('w-condition-invisible')) return;
    const href = ($el.attr('href') || '').trim();
    if (!href || href === '#') return;
    const img = $el.find('img').attr('src') || '';
    if (img.toLowerCase().includes('twitter')) twitterUrl = href;
    if (img.toLowerCase().includes('instagram')) instagramUrl = href;
  });

  // Logo image
  const logoImg = $('img.title-link--image').first();
  const logoUrl = logoImg.attr('src') || '';

  return {
    name,
    description,
    accessType,
    badgeTextColor,
    badgeBgColor,
    websiteUrl,
    twitterUrl,
    instagramUrl,
    logoUrl
  };
}

async function scrapeAllCommunities(urls) {
  const communities = {};
  let count = 0;

  for (const url of urls) {
    count++;
    const slug = url.split('/community/')[1];
    console.log(`[${count}/${urls.length}] Scraping ${slug}...`);

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);
      const data = scrapeCommunityPage($);
      data.slug = slug.trim();
      if (data.name) {
        communities[data.name] = data;
      } else {
        console.error(`  Warning: no name found for ${slug}`);
      }
    } catch (err) {
      console.error(`  Error scraping ${url}: ${err.message}`);
    }

    if (count % 10 === 0) await delay(500);
  }

  return communities;
}

async function scrapeFilterPage(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const names = [];

  // Community cards on filter pages
  $('h2.text-2xl.title, h2.title').each((_, el) => {
    const name = $(el).text().trim();
    if (name) names.push(name);
  });

  return names;
}

async function scrapeLocations(communities) {
  console.log('\nScraping location pages...');
  for (const slug of LOCATION_SLUGS) {
    const url = `${BASE_URL}/location/${slug}`;
    const label = LOCATION_LABELS[slug];
    console.log(`  Location: ${label} (${slug})`);

    try {
      const names = await scrapeFilterPage(url);
      for (const name of names) {
        if (communities[name]) {
          if (!communities[name].locations) communities[name].locations = [];
          if (!communities[name].locations.includes(label)) {
            communities[name].locations.push(label);
          }
        }
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }

    await delay(300);
  }
}

async function scrapeTypes(communities) {
  console.log('\nScraping type pages...');
  for (const slug of TYPE_SLUGS) {
    const url = `${BASE_URL}/type/${slug}`;
    const label = TYPE_LABELS[slug];
    console.log(`  Type: ${label} (${slug})`);

    try {
      const names = await scrapeFilterPage(url);
      for (const name of names) {
        if (communities[name]) {
          if (!communities[name].types) communities[name].types = [];
          if (!communities[name].types.includes(label)) {
            communities[name].types.push(label);
          }
        }
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }

    await delay(300);
  }
}

async function main() {
  try {
    // Phase A: Get all community URLs from sitemap and scrape each
    const urls = await getSitemapUrls();
    const communities = await scrapeAllCommunities(urls);

    // Phase B: Scrape location and type pages to map communities
    await scrapeLocations(communities);
    await scrapeTypes(communities);

    // Convert to array and sort by name
    const result = Object.values(communities)
      .map(c => ({
        name: c.name,
        slug: c.slug,
        description: c.description,
        accessType: c.accessType,
        badgeTextColor: c.badgeTextColor,
        badgeBgColor: c.badgeBgColor,
        websiteUrl: c.websiteUrl,
        twitterUrl: c.twitterUrl,
        instagramUrl: c.instagramUrl,
        logoUrl: c.logoUrl,
        locations: c.locations || [],
        types: c.types || []
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Write output
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
    console.log(`\nDone! Wrote ${result.length} communities to ${OUTPUT_PATH}`);

    // Also generate js/data.js
    const dataJsPath = path.join(__dirname, '..', 'js', 'data.js');
    fs.writeFileSync(dataJsPath, `const COMMUNITIES_DATA = ${JSON.stringify(result, null, 2)};\n`);
    console.log(`Generated ${dataJsPath}`);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();

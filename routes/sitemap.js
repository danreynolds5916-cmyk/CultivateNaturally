const express = require('express');
const router  = express.Router();
const Product  = require('../models/Product');
const BlogPost = require('../models/BlogPost');

const BASE = 'https://cultivatenaturally.shop';

// GET /api/sitemap — full XML sitemap: static pages + products + PUBLISHED blog posts only
router.get('/', async (req, res) => {
    try {
        const [products, posts] = await Promise.all([
            Product.find({}, '_id updatedAt').lean(),
            BlogPost.find({ status: 'published' }, '_id slug updatedAt').lean()  // published only
        ]);

        const today = new Date().toISOString().split('T')[0];

        const urlEntry = (loc, lastmod, changefreq = 'weekly', priority = '0.7') =>
            `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

        // ── Static pages ───────────────────────────────────────────────────────
        const staticUrls = [
            urlEntry(`${BASE}/`,               today, 'weekly',  '1.0'),
            urlEntry(`${BASE}/shop.html`,      today, 'weekly',  '0.9'),
            urlEntry(`${BASE}/Blog.html`,      today, 'weekly',  '0.8'),
            urlEntry(`${BASE}/ContactUs.html`, today, 'monthly', '0.6'),
        ];

        // ── Product pages ──────────────────────────────────────────────────────
        const productUrls = products.map(p =>
            urlEntry(
                `${BASE}/ProductDetail_v4.html?id=${p._id}`,
                p.updatedAt ? p.updatedAt.toISOString().split('T')[0] : today,
                'weekly',
                '0.8'
            )
        );

        // ── Blog post pages (published only) ───────────────────────────────────
        const postUrls = posts.map(p =>
            urlEntry(
                `${BASE}/BlogPost.html?id=${p._id}`,
                p.updatedAt ? p.updatedAt.toISOString().split('T')[0] : today,
                'monthly',
                '0.7'
            )
        );

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...staticUrls,
            ...productUrls,
            ...postUrls,
            '</urlset>'
        ].join('\n');

        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1 hr
        res.send(xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).send('<?xml version="1.0"?><error>Sitemap generation failed</error>');
    }
});

module.exports = router;

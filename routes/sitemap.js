const express = require('express');
const router  = express.Router();
const Product  = require('../models/Product');
const BlogPost = require('../models/BlogPost');

const BASE = 'https://cultivatenaturally.shop';

// GET /api/sitemap — returns XML sitemap with all product + blog post URLs
router.get('/', async (req, res) => {
    try {
        const [products, posts] = await Promise.all([
            Product.find({}, '_id updatedAt').lean(),
            BlogPost.find({}, '_id updatedAt').lean()
        ]);

        const today = new Date().toISOString().split('T')[0];

        const urlEntry = (loc, lastmod, changefreq = 'weekly', priority = '0.7') =>
            `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

        const productUrls = products.map(p =>
            urlEntry(
                `${BASE}/ProductDetail_v4.html?id=${p._id}`,
                p.updatedAt ? p.updatedAt.toISOString().split('T')[0] : today,
                'weekly',
                '0.8'
            )
        );

        const postUrls = posts.map(p =>
            urlEntry(
                `${BASE}/BlogPost.html?id=${p._id}`,
                p.updatedAt ? p.updatedAt.toISOString().split('T')[0] : today,
                'weekly',
                '0.7'
            )
        );

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...productUrls,
            ...postUrls,
            '</urlset>'
        ].join('\n');

        res.setHeader('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).send('<?xml version="1.0"?><error>Sitemap generation failed</error>');
    }
});

module.exports = router;

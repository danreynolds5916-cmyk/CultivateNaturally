/**
 * GET /api/prerender/blog/:id
 *
 * Returns a fully server-side rendered HTML page for a blog post.
 * Use this URL with Google Search Console's URL Inspection tool to verify
 * that Google can read your post content.
 *
 * Example: https://api.cultivatenaturally.shop/api/prerender/blog/699b7d899548e7253ffab672
 *
 * Future: Point a Cloudflare Worker at this endpoint so bot traffic
 * to BlogPost.html?id=xxx is transparently served this pre-rendered HTML
 * while regular users continue to get the normal client-side page.
 */

const express  = require('express');
const router   = express.Router();
const BlogPost = require('../models/BlogPost');

const BASE = 'https://cultivatenaturally.shop';
const API  = 'https://api.cultivatenaturally.shop';

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

router.get('/blog/:id', async (req, res) => {
    try {
        const post = await BlogPost.findOne({
            $or: [
                { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
                { slug: req.params.id }
            ],
            status: 'published'
        }).lean();

        if (!post) return res.status(404).send('<html><body><h1>Post not found</h1></body></html>');

        const rawText   = (post.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const desc      = esc(post.metaDescription || post.excerpt || rawText.substring(0, 155));
        const title     = esc(post.metaTitle || post.title);
        const img       = esc(post.featuredImage || `${BASE}/images/logo.png`);
        const canonical = `${BASE}/BlogPost.html?id=${post._id}`;
        const pubDate   = post.publishDate || post.createdAt;
        const modDate   = post.updatedAt || pubDate;

        const jsonLd = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            image: post.featuredImage || `${BASE}/images/logo.png`,
            datePublished: pubDate,
            dateModified: modDate,
            author: { '@type': 'Organization', name: post.author || 'Cultivate Naturally' },
            publisher: {
                '@type': 'Organization',
                name: 'Cultivate Naturally',
                url: BASE,
                logo: { '@type': 'ImageObject', url: `${BASE}/images/logo.png` }
            },
            description: post.metaDescription || post.excerpt || rawText.substring(0, 155),
            articleBody: rawText.substring(0, 5000),
            keywords: (post.tags || []).join(', '),
            url: canonical
        });

        const tagsHtml = (post.tags || []).map(t =>
            `<a href="${BASE}/Blog.html?category=${encodeURIComponent(t)}" style="margin-right:6px;color:#748a53">#${esc(t)}</a>`
        ).join('');

        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | Cultivate Naturally</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title} | Cultivate Naturally">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${img}">
  <meta property="article:published_time" content="${pubDate}">
  <meta property="article:modified_time" content="${modDate}">
  ${(post.tags || []).map(t => `<meta property="article:tag" content="${esc(t)}">`).join('\n  ')}
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem;color:#333;line-height:1.8}
    h1{color:#2d5a27;font-size:2rem;margin-bottom:0.5rem}
    .meta{color:#6c757d;font-size:0.9rem;margin-bottom:1.5rem}
    img{max-width:100%;height:auto;border-radius:8px;margin:1rem 0}
    a{color:#748a53}
    .back{display:inline-block;margin-bottom:2rem;color:#748a53}
  </style>
</head>
<body>
  <a href="${BASE}/Blog.html" class="back">← Back to Blog</a>
  <h1>${esc(post.title)}</h1>
  <div class="meta">
    By ${esc(post.author || 'Cultivate Naturally')} &nbsp;·&nbsp;
    ${new Date(pubDate).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
    ${post.category ? `&nbsp;·&nbsp; ${esc(post.category)}` : ''}
  </div>
  ${post.featuredImage ? `<img src="${img}" alt="${esc(post.title)}">` : ''}
  <article>${post.content || esc(post.excerpt || '')}</article>
  ${tagsHtml ? `<div style="margin-top:2rem">${tagsHtml}</div>` : ''}
  <hr style="margin:2rem 0">
  <p><a href="${esc(canonical)}">View this post on Cultivate Naturally →</a></p>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(html);

    } catch (err) {
        console.error('Prerender error:', err);
        res.status(500).send('<html><body><h1>Server error</h1></body></html>');
    }
});

module.exports = router;

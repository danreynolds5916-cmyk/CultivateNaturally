/**
 * middleware/cloudinaryUpload.js
 * Multer storage that uploads images directly to Cloudinary.
 * Replaces middleware/upload.js for blog post and product images.
 *
 * Configured automatically via CLOUDINARY_URL env var:
 *   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 * (cloudinary v1 SDK reads this env var automatically — no manual config needed)
 *
 * Uploaded file URL → req.file.path  (single)
 *                     req.files[i].path  (array)
 */
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
// cloudinary v1 auto-reads CLOUDINARY_URL from the environment
const cloudinary = require('cloudinary').v2;

const storage = new CloudinaryStorage({
    cloudinary,
    params: (req) => {
        // Separate folders for blog posts vs products
        const folder = (req.baseUrl || '').includes('blog')
            ? 'cultivate-naturally/blog'
            : 'cultivate-naturally/products';
        return {
            folder,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            resource_type: 'image'
        };
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpg, png, gif, webp)'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

module.exports = { upload, cloudinary };

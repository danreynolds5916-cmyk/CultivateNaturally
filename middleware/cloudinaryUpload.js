/**
 * middleware/cloudinaryUpload.js
 * Multer storage that uploads images directly to Cloudinary.
 * Replaces middleware/upload.js for blog post and product images.
 *
 * Required Railway env vars:
 *   CLOUDINARY_CLOUD_NAME   (the part after @ in your Cloudinary URL)
 *   CLOUDINARY_API_KEY      (the part before : after cloudinary://)
 *   CLOUDINARY_API_SECRET   (the part between : and @)
 *
 * Uploaded file URL → req.file.path  (single)
 *                     req.files[i].path  (array)
 */
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Delete CLOUDINARY_URL before requiring cloudinary so the SDK never tries
// to auto-parse it (it throws on startup if the format isn't exactly right).
delete process.env.CLOUDINARY_URL;

const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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

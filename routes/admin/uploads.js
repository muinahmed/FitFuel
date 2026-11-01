// Shared admin route (Recipes admin – Albina, Workouts admin – Priyanka)
// Upload a photo for a recipe or an exercise. The admin form then saves the returned path
// with the recipe or workout. Jira epic FF-27 (Admin back end).
const express = require('express');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { MAX_IMAGE_BYTES, detectImageType, saveImage } = require('../../utils/uploads');

const router = express.Router();

router.use(requireAdmin);

// POST /api/admin/uploads – the image file itself as the request body (Content-Type image/jpeg, image/png or image/webp)
router.post('/', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_IMAGE_BYTES }), (req, res) => {
  const type = Buffer.isBuffer(req.body) ? detectImageType(req.body) : null;
  if (!type) return res.status(400).json({ error: 'Choose a JPG, PNG or WebP image.' });
  res.status(201).json({ path: saveImage(req.body, type) });
});

module.exports = router;

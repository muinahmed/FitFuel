// Uploaded photos, shared by the recipes admin (Albina) and workouts admin (Priyanka).
// Files are saved with random names in public/uploads (or UPLOAD_DIR in tests) and served at /uploads/.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'public', 'uploads');
const UPLOAD_URL = '/uploads/';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Only paths this module created are accepted, e.g. /uploads/3f9c…e1.webp
const UPLOAD_PATH_PATTERN = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;
const BUNDLED_RECIPE_IMAGE_PATTERN = /^\/img\/recipes\/(0[1-9]|[1-3][0-9]|4[0-6])\.png$/;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const isRecipeImage = db.prepare('SELECT 1 FROM RecipeImage WHERE ImagePath = ?');
const isExerciseImage = db.prepare('SELECT 1 FROM WorkoutExercise WHERE ImagePath = ?');

// Image type from the file's first bytes (not from its name), or null if it is not JPG, PNG or WebP
function detectImageType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// Save an image and return its web path
function saveImage(buffer, type) {
  const fileName = `${crypto.randomBytes(16).toString('hex')}.${type}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
  return UPLOAD_URL + fileName;
}

function filePathFor(webPath) {
  return path.join(UPLOAD_DIR, path.basename(webPath));
}

// Photo path sent with a recipe or exercise: null when there is no photo ('' or missing),
// the path when it is an existing upload, or undefined when it is not allowed
function readImagePath(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && BUNDLED_RECIPE_IMAGE_PATTERN.test(value)
    && fs.existsSync(path.join(__dirname, '..', 'public', value.slice(1)))) return value;
  if (typeof value !== 'string' || !UPLOAD_PATH_PATTERN.test(value) || !fs.existsSync(filePathFor(value))) return undefined;
  return value;
}

// Delete uploaded files that no recipe or exercise uses any more
function deleteUnusedImages(webPaths) {
  for (const webPath of new Set(webPaths.filter(Boolean))) {
    if (!UPLOAD_PATH_PATTERN.test(webPath)) continue;
    if (isRecipeImage.get(webPath) || isExerciseImage.get(webPath)) continue;
    fs.rmSync(filePathFor(webPath), { force: true });
  }
}

module.exports = { UPLOAD_DIR, MAX_IMAGE_BYTES, detectImageType, saveImage, readImagePath, deleteUnusedImages };

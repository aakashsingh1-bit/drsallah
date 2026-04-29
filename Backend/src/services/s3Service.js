const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

// ─── Generate S3 key for a file ────────────────────────────────────────────────
const generateS3Key = (folder, originalName) => {
  const ext = path.extname(originalName);
  return `${folder}/${uuidv4()}${ext}`;
};

// ─── Upload buffer directly to S3 ─────────────────────────────────────────────
const uploadToS3 = async (buffer, key, mimetype, metadata = {}) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    Metadata: metadata,
    ServerSideEncryption: 'AES256',
  });
  await s3.send(command);
  return { key, url: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}` };
};

// ─── Generate presigned upload URL (for direct browser-to-S3 upload) ──────────
const getPresignedUploadUrl = async (key, mimetype, expiresIn = 3600) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimetype,
    ServerSideEncryption: 'AES256',
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { uploadUrl: url, key };
};

// ─── Generate presigned download/stream URL ────────────────────────────────────
const getPresignedStreamUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { streamUrl: url, expires: Math.floor(Date.now() / 1000) + expiresIn };
};

// ─── Delete object from S3 ─────────────────────────────────────────────────────
const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await s3.send(command);
};

// ─── Upload thumbnail image ────────────────────────────────────────────────────
const uploadThumbnail = async (buffer, originalName) => {
  const key = generateS3Key('thumbnails', originalName);
  return uploadToS3(buffer , key, 'image/jpeg');
};

// ─── Upload gallery image ──────────────────────────────────────────────────────
const uploadGalleryImage = async (buffer, originalName, mimetype = 'image/jpeg') => {
  const key = generateS3Key('gallery', originalName);
  return uploadToS3(buffer, key, mimetype);
};

// ─── Get presigned URL for video upload ───────────────────────────────────────
const getVideoUploadUrl = async (courseId, lessonId, filename) => {
  const key = `videos/${courseId}/${lessonId}/${uuidv4()}-${filename}`;
  return getPresignedUploadUrl(key, 'video/mp4', 7200); // 2hr to upload
};

module.exports = {
  s3,
  BUCKET,
  generateS3Key,
  uploadToS3,
  getPresignedUploadUrl,
  getPresignedStreamUrl,
  deleteFromS3,
  uploadThumbnail,
  uploadGalleryImage,
  getVideoUploadUrl,
};

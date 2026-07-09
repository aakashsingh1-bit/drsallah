const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Disable flexible checksums — they add x-amz-checksum-* query params that
  // cause CORS issues when browsers upload directly to S3 via presigned URLs.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET = process.env.AWS_S3_BUCKET;

// ─── Generate S3 key for a file ────────────────────────────────────────────────
const generateS3Key = (folder, originalName) => {
  const ext = path.extname(originalName);
  return `${folder}/${uuidv4()}${ext}`;
};

// ─── Upload buffer directly to S3 (max 5GB per PutObjectCommand) ─────────────
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

// ─── Upload large file from disk using S3 multipart upload (for >5GB files) ──
const uploadLargeFileToS3 = async (filePath, key, mimetype, metadata = {}) => {
  const PART_SIZE = 10 * 1024 * 1024; // 10MB per part (minimum is 5MB)
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const numParts = Math.ceil(fileSize / PART_SIZE);

  // 1. Initiate multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimetype,
    Metadata: metadata,
    ServerSideEncryption: 'AES256',
  });
  const { UploadId } = await s3.send(createCommand);

  const uploadedParts = [];
  const fd = fs.openSync(filePath, 'r');

  try {
    for (let i = 0; i < numParts; i++) {
      const start = i * PART_SIZE;
      const partSize = Math.min(PART_SIZE, fileSize - start);
      const buffer = Buffer.alloc(partSize);
      fs.readSync(fd, buffer, 0, partSize, start);

      const uploadPartCommand = new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        PartNumber: i + 1,
        UploadId,
        Body: buffer,
      });
      const { ETag } = await s3.send(uploadPartCommand);
      uploadedParts.push({ ETag, PartNumber: i + 1 });

      console.log(`  → Multipart upload progress: ${((i + 1) / numParts * 100).toFixed(1)}% (part ${i + 1}/${numParts})`);
    }
  } catch (err) {
    // Abort multipart upload on failure
    await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId }));
    fs.closeSync(fd);
    throw err;
  }

  fs.closeSync(fd);

  // 3. Complete multipart upload
  const completeCommand = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId,
    MultipartUpload: { Parts: uploadedParts },
  });
  await s3.send(completeCommand);

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
    ResponseContentType: guessContentType(key),
    ResponseCacheControl: 'private, max-age=3600',
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { streamUrl: url, expires: Math.floor(Date.now() / 1000) + expiresIn };
};

const guessContentType = (key) => {
  const ext = (key || '').split('.').pop()?.toLowerCase();
  const map = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v' };
  return map[ext] || 'video/mp4';
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

// ═════════════════════════════════════════════════════════════════════════════
// DIRECT BROWSER-TO-S3 MULTIPART UPLOAD (like YouTube)
// ═════════════════════════════════════════════════════════════════════════════
// The browser splits the file into chunks and uploads each chunk directly to S3
// via presigned URLs. This bypasses the server entirely for the upload data,
// making it as fast as the user's internet connection allows.
//
// Part size: 10MB (minimum allowed by S3 is 5MB, except for the last part)
// Max parts: 10,000 (S3 limit) → supports files up to 100TB

/**
 * Initiate a multipart upload and generate presigned URLs for all parts.
 * The browser will upload each part directly to S3 using these URLs.
 */
const initMultipartUploadToS3 = async (key, mimetype, fileSize, metadata = {}) => {
  // Use 50MB per part — fewer parts = fewer round trips = faster upload
  // AWS supports up to 10,000 parts, so 50MB handles up to ~500GB
  const PART_SIZE = 50 * 1024 * 1024; // 50MB per part
  const numParts = Math.ceil(fileSize / PART_SIZE);

  // Initiate multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimetype,
    Metadata: metadata,
    ServerSideEncryption: 'AES256',
  });
  const { UploadId } = await s3.send(createCommand);

  // Generate presigned URLs for ALL parts IN PARALLEL using Promise.all
  // Sequential generation is a major bottleneck (each getSignedUrl call takes ~200-500ms)
  const partUrlPromises = [];
  for (let i = 0; i < numParts; i++) {
    const partNumber = i + 1;
    const uploadPartCommand = new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      PartNumber: partNumber,
      UploadId,
    });
    // Presigned URL valid for 24 hours (generous for large files)
    partUrlPromises.push(
      getSignedUrl(s3, uploadPartCommand, { expiresIn: 86400 })
        .then(url => ({ partNumber, url }))
    );
  }
  const partUrls = await Promise.all(partUrlPromises);

  return { UploadId, key, partUrls, numParts, partSize: PART_SIZE };
};

/**
 * Complete a multipart upload after all parts have been uploaded by the browser.
 * The browser sends back the ETags it received from each part upload.
 */
const completeMultipartUploadToS3 = async (key, UploadId, parts) => {
  const completeCommand = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId,
    MultipartUpload: { Parts: parts },
  });
  await s3.send(completeCommand);
  return { key, url: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}` };
};

/**
 * Abort a multipart upload (cleanup on failure).
 */
const abortMultipartUploadToS3 = async (key, UploadId) => {
  try {
    await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId }));
  } catch {} // Silently ignore — already aborted or not found
};

module.exports = {
  s3,
  BUCKET,
  generateS3Key,
  uploadToS3,
  uploadLargeFileToS3,
  getPresignedUploadUrl,
  getPresignedStreamUrl,
  deleteFromS3,
  uploadThumbnail,
  uploadGalleryImage,
  getVideoUploadUrl,
  initMultipartUploadToS3,
  completeMultipartUploadToS3,
  abortMultipartUploadToS3,
};

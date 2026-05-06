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
  uploadLargeFileToS3,
  getPresignedUploadUrl,
  getPresignedStreamUrl,
  deleteFromS3,
  uploadThumbnail,
  uploadGalleryImage,
  getVideoUploadUrl,
};

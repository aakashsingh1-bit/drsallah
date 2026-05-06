const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
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
const PART_SIZE = 10 * 1024 * 1024; // 10MB chunks

/**
 * Custom Multer storage engine that streams directly to S3 via multipart upload.
 * No disk writes, no full-file memory buffer — only 10MB chunks in memory at a time.
 *
 * Usage:
 *   const upload = multer({ storage: s3StreamStorage() });
 *   router.post('/upload', upload.single('video'), handler);
 *
 * The file object on req.file will have: { key, size, bucket, location, originalname, mimetype }
 */
const s3StreamStorage = (opts = {}) => {
  const {
    bucket = BUCKET,
    partSize = PART_SIZE,
    keyPrefix = 'videos',
  } = opts;

  const _handleFile = (req, file, cb) => {
    // Generate S3 key from the request params
    const lessonId = req.params.lessonId || 'unknown';
    const ext = path.extname(file.originalname) || '.mp4';
    const key = `${keyPrefix}/${lessonId}/${uuidv4()}${ext}`;

    (async () => {
      // 1. Initiate multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: file.mimetype,
        Metadata: { originalName: file.originalname },
        ServerSideEncryption: 'AES256',
      });
      const { UploadId } = await s3.send(createCommand);

      const uploadedParts = [];
      let partNumber = 0;
      let currentChunk = Buffer.alloc(0);
      let totalBytes = 0;

      return new Promise((resolve, reject) => {
        file.stream.on('data', async (chunk) => {
          file.stream.pause();
          try {
            currentChunk = Buffer.concat([currentChunk, chunk]);

            while (currentChunk.length >= partSize) {
              partNumber++;
              const partBuffer = currentChunk.subarray(0, partSize);
              currentChunk = currentChunk.subarray(partSize);

              const uploadPartCommand = new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                PartNumber: partNumber,
                UploadId,
                Body: partBuffer,
              });
              const { ETag } = await s3.send(uploadPartCommand);
              uploadedParts.push({ ETag, PartNumber: partNumber });
              totalBytes += partSize;
            }
            file.stream.resume();
          } catch (err) {
            try { await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId })); } catch {}
            reject(err);
          }
        });

        file.stream.on('end', async () => {
          try {
            // Upload final chunk
            if (currentChunk.length > 0) {
              partNumber++;
              const uploadPartCommand = new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                PartNumber: partNumber,
                UploadId,
                Body: currentChunk,
              });
              const { ETag } = await s3.send(uploadPartCommand);
              uploadedParts.push({ ETag, PartNumber: partNumber });
              totalBytes += currentChunk.length;
            }

            // Handle empty file
            if (uploadedParts.length === 0) {
              const uploadPartCommand = new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                PartNumber: 1,
                UploadId,
                Body: Buffer.alloc(0),
              });
              const { ETag } = await s3.send(uploadPartCommand);
              uploadedParts.push({ ETag, PartNumber: 1 });
            }

            // Complete multipart upload
            const completeCommand = new CompleteMultipartUploadCommand({
              Bucket: bucket,
              Key: key,
              UploadId,
              MultipartUpload: { Parts: uploadedParts },
            });
            await s3.send(completeCommand);

            resolve({
              key,
              size: totalBytes,
              bucket,
              originalname: file.originalname,
              mimetype: file.mimetype,
              location: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
            });
          } catch (err) {
            try { await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId })); } catch {}
            reject(err);
          }
        });

        file.stream.on('error', async (err) => {
          try { await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId })); } catch {}
          reject(err);
        });
      });
    })()
      .then((result) => cb(null, result))
      .catch((err) => cb(err));
  };

  const _removeFile = (req, file, cb) => {
    // File is already in S3 — deletion handled separately via s3Service.deleteFromS3
    cb(null);
  };

  return { _handleFile, _removeFile };
};

module.exports = { s3StreamStorage };

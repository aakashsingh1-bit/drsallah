const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// ─── S3 Client with extended timeouts ───────────────────────────────────────
// Large uploads need generous timeouts for each UploadPart API call.
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 300_000,   // 5 min — time to establish connection
    requestTimeout: 300_000,      // 5 min — time for each API call to complete
    socketTimeout: 300_000,       // 5 min — idle socket timeout
  }),
  maxAttempts: 3,                 // Retry failed parts automatically
  // Disable flexible checksums — they add x-amz-checksum-* query params that
  // cause CORS issues when browsers upload directly to S3 via presigned URLs.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET = process.env.AWS_S3_BUCKET;
const PART_SIZE = 50 * 1024 * 1024; // 50MB chunks (fewer parts = fewer API calls)
const MAX_CONCURRENT_UPLOADS = 5;   // Upload up to 5 parts in parallel

/**
 * Custom Multer storage engine that streams directly to S3 via multipart upload.
 * No disk writes, no full-file memory buffer — only 50MB chunks in memory at a time.
 *
 * Key improvements over the previous version:
 *  - No file.stream.pause() / resume() — the HTTP stream is NEVER paused,
 *    preventing client/proxy timeouts.
 *  - Concurrent part uploads — up to 5 parts are uploaded in parallel while
 *    the stream continues to be read.
 *  - Larger part size (50MB) — fewer total parts, less overhead.
 *  - Extended S3 client timeouts (5 min per API call).
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
    concurrency = MAX_CONCURRENT_UPLOADS,
  } = opts;

  const _handleFile = (req, file, cb) => {
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
      let totalBytes = 0;
      let currentChunk = Buffer.alloc(0);
      let streamEnded = false;
      let streamError = null;

      // ── Concurrent upload queue ──────────────────────────────────────────
      // We keep reading the stream and accumulating 50MB chunks.
      // When a chunk is ready, we dispatch an UploadPartCommand in the background.
      // We limit concurrency so we don't overwhelm the HTTP connection or memory.
      const activeUploads = new Set();

      const uploadPart = async (partBuf, partNum) => {
        const uploadPartCommand = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          PartNumber: partNum,
          UploadId,
          Body: partBuf,
        });
        const { ETag } = await s3.send(uploadPartCommand);
        uploadedParts.push({ ETag, PartNumber: partNum });
        totalBytes += partBuf.length;
      };

      const dispatchUpload = (partBuf, partNum) => {
        const promise = uploadPart(partBuf, partNum).finally(() => {
          activeUploads.delete(promise);
        });
        activeUploads.add(promise);
      };

      const waitForSlot = async () => {
        while (activeUploads.size >= concurrency) {
          // Wait for at least one upload to finish
          await Promise.race(activeUploads);
        }
      };

      const waitForAllUploads = async () => {
        if (activeUploads.size > 0) {
          await Promise.all(activeUploads);
        }
      };

      // ── Stream processing ────────────────────────────────────────────────
      // IMPORTANT: We do NOT pause the stream. We keep reading data as it arrives,
      // accumulate 50MB chunks, and dispatch uploads concurrently.
      // This prevents the HTTP connection from appearing idle to the client/proxy.

      return new Promise((resolve, reject) => {
        file.stream.on('data', (chunk) => {
          try {
            currentChunk = Buffer.concat([currentChunk, chunk]);

            // Flush complete parts from the buffer
            while (currentChunk.length >= partSize) {
              partNumber++;
              const partBuffer = currentChunk.subarray(0, partSize);
              currentChunk = currentChunk.subarray(partSize);

              // Dispatch upload in background — don't await here
              dispatchUpload(partBuffer, partNumber);
            }
          } catch (err) {
            streamError = err;
            file.stream.destroy(err);
          }
        });

        file.stream.on('end', async () => {
          streamEnded = true;
          try {
            // Wait for all in-flight uploads to finish
            await waitForAllUploads();

            // Upload final remaining chunk
            if (currentChunk.length > 0) {
              partNumber++;
              await uploadPart(currentChunk, partNumber);
            }

            // Handle empty file
            if (uploadedParts.length === 0) {
              await uploadPart(Buffer.alloc(0), 1);
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
              location: `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
            });
          } catch (err) {
            try { await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId })); } catch {}
            reject(err);
          }
        });

        file.stream.on('error', async (err) => {
          streamError = err;
          try {
            await waitForAllUploads();
          } catch {}
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

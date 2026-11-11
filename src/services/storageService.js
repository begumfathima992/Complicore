/**
 * All object-storage access goes through this one module. Swapping
 * providers later (R2 -> S3 -> GCS, etc.) should only ever mean changing
 * this file + its env vars - nothing in the controllers should know or
 * care that the backing store is R2 specifically.
 *
 * R2 is accessed via the S3-compatible API (AWS SDK v3's S3 client
 * pointed at R2's endpoint, region "auto").
 */
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const UPLOAD_URL_TTL_SECONDS = 300; // 5 minutes
const DOWNLOAD_URL_TTL_SECONDS = 300; // 5 minutes

let client;
function getClient() {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.R2_ENDPOINT,
      region: process.env.R2_REGION || 'auto',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/** Throws if the declared content type / size isn't one we accept. Server-side mirror of the client-side check. */
function validateUpload({ contentType, fileSizeBytes }) {
  if (!ALLOWED_MIME_TYPES[contentType]) {
    const err = new Error(`Unsupported file type '${contentType}'. Allowed: PDF, JPG, PNG.`);
    err.statusCode = 400;
    throw err;
  }
  if (!fileSizeBytes || fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    const err = new Error('File exceeds the 10 MB limit.');
    err.statusCode = 400;
    throw err;
  }
  return ALLOWED_MIME_TYPES[contentType];
}

/** company/{companyId}/employee/{employeeId}/{documentId}-v{version}.{ext} */
function buildObjectKey({ companyId, employeeId, documentId, version, extension }) {
  return `company/${companyId}/employee/${employeeId}/${documentId}-v${version}.${extension}`;
}

/**
 * Pre-signed PUT for a direct-to-R2 upload. The presigned request itself
 * constrains Content-Type and Content-Length to exactly what was
 * validated here, so R2 rejects an upload that doesn't match what the
 * client declared - a client can't silently swap in a different file
 * type after getting the URL.
 */
async function createUploadUrl({ companyId, employeeId, documentId, version, contentType, fileSizeBytes }) {
  const extension = validateUpload({ contentType, fileSizeBytes });
  const key = buildObjectKey({ companyId, employeeId, documentId, version, extension });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSizeBytes,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });

  return { uploadUrl, key, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
}

/** mode: 'inline' (view in-browser) or 'attachment' (force download) via ResponseContentDisposition. */
async function createGetUrl({ key, fileName, mode = 'inline' }) {
  const disposition = `${mode === 'attachment' ? 'attachment' : 'inline'}; filename="${(fileName || 'document').replace(/"/g, '')}"`;
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ResponseContentDisposition: disposition,
  });
  const url = await getSignedUrl(getClient(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
}

async function deleteObject({ key }) {
  await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

/** Pre-generates a UUID so the object key can embed the document's id before the row exists. */
function generateDocumentId() {
  return crypto.randomUUID();
}

module.exports = {
  validateUpload,
  buildObjectKey,
  createUploadUrl,
  createGetUrl,
  deleteObject,
  generateDocumentId,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
};

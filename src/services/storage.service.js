/**
 * Storage Service
 * 
 * Handles file uploads and management using AWS S3
 * 
 * @author meetabl Team
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// Convert fs.readFile to use Promises
const readFile = util.promisify(fs.readFile);
const unlink = util.promisify(fs.unlink);

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const bucketName = process.env.AWS_S3_BUCKET;

/**
 * Uploads a file to S3
 * 
 * @param {Object} fileData - The file data object
 * @param {string} fileData.mimetype - The MIME type of the file
 * @param {string} fileData.path - Path to the temporary file
 * @param {string} fileData.originalname - Original filename
 * @param {string} folder - The folder to store the file in (optional)
 * @returns {Promise<Object>} The uploaded file details
 */
async function uploadFile(fileData, folder = 'uploads') {
  try {
    const fileContent = await readFile(fileData.path);
    const fileExtension = path.extname(fileData.originalname);
    const filename = `${uuidv4()}${fileExtension}`;
    const key = folder ? `${folder}/${filename}` : filename;
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: fileData.mimetype,
      ACL: 'private'
    });
    
    logger.info(`Uploading file to S3: ${key}`);
    
    await s3Client.send(command);
    
    // Remove temporary file using async unlink
    await unlink(fileData.path);
    
    // Construct the URL (SDK v3 doesn't return Location)
    const location = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    
    return {
      key: key,
      url: location,
      filename: filename,
      originalName: fileData.originalname,
      contentType: fileData.mimetype,
      size: fileData.size
    };
  } catch (error) {
    logger.error('Error uploading file to S3:', error);
    throw error;
  }
}

/**
 * Generates a pre-signed URL for accessing a private file
 * 
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} The pre-signed URL
 */
async function getPresignedUrl(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw error;
  }
}

/**
 * Deletes a file from S3
 * 
 * @param {string} key - The S3 object key
 * @returns {Promise<Object>} The deletion result
 */
async function deleteFile(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    
    logger.info(`Deleting file from S3: ${key}`);
    
    const result = await s3Client.send(command);
    return result;
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
    throw error;
  }
}

module.exports = {
  uploadFile,
  getSignedUrl: getPresignedUrl, // Keep the same export name for backward compatibility
  deleteFile
};
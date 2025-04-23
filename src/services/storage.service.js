/**
 * Storage Service
 * 
 * Handles file uploads and management using AWS S3
 * 
 * @author meetabl Team
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// Convert fs.readFile to use Promises
const readFile = util.promisify(fs.readFile);

// Configure AWS S3 client
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
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
    
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: fileData.mimetype,
      ACL: 'private'
    };
    
    logger.info(`Uploading file to S3: ${key}`);
    
    const uploadResult = await s3.upload(params).promise();
    
    // Remove temporary file
    fs.unlinkSync(fileData.path);
    
    return {
      key: uploadResult.Key,
      url: uploadResult.Location,
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
async function getSignedUrl(key, expiresIn = 3600) {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: expiresIn
    };
    
    return s3.getSignedUrlPromise('getObject', params);
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
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    logger.info(`Deleting file from S3: ${key}`);
    return s3.deleteObject(params).promise();
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
    throw error;
  }
}

module.exports = {
  uploadFile,
  getSignedUrl,
  deleteFile
};

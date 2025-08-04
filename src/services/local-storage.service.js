/**
 * Local Storage Service
 * 
 * Handles file uploads and management using local file system for development
 * 
 * @author meetabl Team
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// Ensure upload directories exist
const uploadBaseDir = path.join(__dirname, '../../uploads');
const dirs = ['logos', 'avatars', 'uploads'];

async function ensureDirectories() {
  try {
    await fs.mkdir(uploadBaseDir, { recursive: true });
    for (const dir of dirs) {
      await fs.mkdir(path.join(uploadBaseDir, dir), { recursive: true });
    }
  } catch (error) {
    logger.error('Error creating upload directories:', error);
  }
}

// Initialize directories
ensureDirectories();

/**
 * Uploads a file to local storage
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
    const fileExtension = path.extname(fileData.originalname);
    const filename = `${uuidv4()}${fileExtension}`;
    const relativePath = path.join(folder, filename);
    const absolutePath = path.join(uploadBaseDir, relativePath);
    
    // Copy file from temp location to permanent location
    await fs.copyFile(fileData.path, absolutePath);
    
    // Remove temporary file
    try {
      await fs.unlink(fileData.path);
    } catch (unlinkError) {
      logger.warn(`Failed to delete temp file: ${fileData.path}`, unlinkError);
    }
    
    // Construct the URL (relative to the API endpoint)
    const url = `/uploads/${relativePath.replace(/\\/g, '/')}`;
    
    logger.info(`File uploaded to local storage: ${relativePath}`);
    
    return {
      key: relativePath,
      url: url,
      filename: filename,
      originalName: fileData.originalname,
      contentType: fileData.mimetype,
      size: fileData.size
    };
  } catch (error) {
    logger.error('Error uploading file to local storage:', error);
    throw error;
  }
}

/**
 * Deletes a file from local storage
 * 
 * @param {string} key - The file path key
 * @returns {Promise<Object>} The deletion result
 */
async function deleteFile(key) {
  try {
    const absolutePath = path.join(uploadBaseDir, key);
    
    await fs.unlink(absolutePath);
    
    logger.info(`File deleted from local storage: ${key}`);
    
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn(`File not found for deletion: ${key}`);
      return { success: true }; // Consider it successful if file doesn't exist
    }
    logger.error('Error deleting file from local storage:', error);
    throw error;
  }
}

/**
 * Generates a URL for accessing a file (no signing needed for local storage)
 * 
 * @param {string} key - The file path key
 * @returns {Promise<string>} The file URL
 */
async function getPresignedUrl(key) {
  // For local storage, just return the direct URL
  return `/uploads/${key.replace(/\\/g, '/')}`;
}

module.exports = {
  uploadFile,
  getSignedUrl: getPresignedUrl,
  deleteFile
};
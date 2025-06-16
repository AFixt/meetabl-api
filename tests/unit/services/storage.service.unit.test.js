/**
 * Storage service unit tests
 *
 * Tests for the AWS S3 storage service with SDK v3
 *
 * @author meetabl Team
 */

// Skip tests if AWS SDK v3 packages are not installed
let skipTests = false;
try {
  require.resolve('@aws-sdk/client-s3');
  require.resolve('@aws-sdk/s3-request-presigner');
} catch (error) {
  skipTests = true;
}

// Mock AWS SDK v3 modules only if they exist
if (!skipTests) {
  jest.mock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn()
    })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn()
  }));

  jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn()
  }));
}

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFile: jest.fn((path, callback) => {
    callback(null, Buffer.from('test file content'));
  }),
  unlink: jest.fn((path, callback) => {
    callback(null);
  })
}));

// Mock util.promisify
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) => {
    if (fn.name === 'readFile') {
      return jest.fn().mockResolvedValue(Buffer.from('test file content'));
    }
    if (fn.name === 'unlink') {
      return jest.fn().mockResolvedValue(undefined);
    }
    return fn;
  })
}));

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Storage Service', () => {
  if (skipTests) {
    test.skip('AWS SDK v3 packages not installed - skipping tests', () => {});
    return;
  }

  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const storageService = require('../../../src/services/storage.service');
  const logger = require('../../../src/config/logger');
  let mockS3Client;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.AWS_S3_BUCKET = 'test-bucket';

    // Get the mocked S3Client instance
    mockS3Client = new S3Client();
  });

  describe('uploadFile', () => {
    test('should upload file successfully', async () => {
      // Mock successful upload
      mockS3Client.send.mockResolvedValueOnce({});

      const fileData = {
        mimetype: 'image/jpeg',
        path: '/tmp/test-file.jpg',
        originalname: 'test.jpg',
        size: 1024
      };

      const result = await storageService.uploadFile(fileData, 'avatars');

      // Verify PutObjectCommand was called with correct params
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: expect.stringMatching(/^avatars\/[\w-]+\.jpg$/),
        Body: expect.any(Buffer),
        ContentType: 'image/jpeg',
        ACL: 'private'
      });

      // Verify S3 client send was called
      expect(mockS3Client.send).toHaveBeenCalled();

      // Verify result structure
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('filename');
      expect(result.originalName).toBe('test.jpg');
      expect(result.contentType).toBe('image/jpeg');
      expect(result.size).toBe(1024);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Uploading file to S3:'));
    });

    test('should handle upload errors', async () => {
      // Mock upload failure
      const error = new Error('Upload failed');
      mockS3Client.send.mockRejectedValueOnce(error);

      const fileData = {
        mimetype: 'image/jpeg',
        path: '/tmp/test-file.jpg',
        originalname: 'test.jpg',
        size: 1024
      };

      await expect(storageService.uploadFile(fileData)).rejects.toThrow('Upload failed');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error uploading file to S3:', error);
    });

    test('should use default folder if not specified', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const fileData = {
        mimetype: 'application/pdf',
        path: '/tmp/test-file.pdf',
        originalname: 'document.pdf',
        size: 2048
      };

      await storageService.uploadFile(fileData);

      // Verify default folder 'uploads' was used
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: expect.stringMatching(/^uploads\/[\w-]+\.pdf$/)
        })
      );
    });
  });

  describe('getSignedUrl', () => {
    test('should generate signed URL successfully', async () => {
      // Mock successful URL generation
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/test-key?signature=xyz';
      getSignedUrl.mockResolvedValueOnce(mockUrl);

      const result = await storageService.getSignedUrl('test-key', 7200);

      // Verify GetObjectCommand was called
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key'
      });

      // Verify getSignedUrl was called with correct params
      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 7200 }
      );

      expect(result).toBe(mockUrl);
    });

    test('should use default expiration time', async () => {
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/test-key?signature=abc';
      getSignedUrl.mockResolvedValueOnce(mockUrl);

      await storageService.getSignedUrl('test-key');

      // Verify default expiration of 3600 seconds (1 hour) was used
      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    test('should handle errors when generating signed URL', async () => {
      const error = new Error('Failed to generate URL');
      getSignedUrl.mockRejectedValueOnce(error);

      await expect(storageService.getSignedUrl('test-key')).rejects.toThrow('Failed to generate URL');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error generating signed URL:', error);
    });
  });

  describe('deleteFile', () => {
    test('should delete file successfully', async () => {
      // Mock successful deletion
      const mockResult = { DeleteMarker: false };
      mockS3Client.send.mockResolvedValueOnce(mockResult);

      const result = await storageService.deleteFile('test-key');

      // Verify DeleteObjectCommand was called
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key'
      });

      // Verify S3 client send was called
      expect(mockS3Client.send).toHaveBeenCalled();

      expect(result).toEqual(mockResult);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Deleting file from S3: test-key');
    });

    test('should handle deletion errors', async () => {
      const error = new Error('Delete failed');
      mockS3Client.send.mockRejectedValueOnce(error);

      await expect(storageService.deleteFile('test-key')).rejects.toThrow('Delete failed');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error deleting file from S3:', error);
    });
  });
});
/**
 * Log management service
 * 
 * Handles log rotation, cleanup, compression, and centralized log shipping
 * 
 * @author meetabl Team
 */

const fs = require('fs').promises;
const path = require('path');
const { createGzip } = require('zlib');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const { createLogger } = require('../config/logger');

const logger = createLogger('log-management');

class LogManagementService {
  constructor() {
    this.logsDir = path.join(__dirname, '../../logs');
    this.retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '30', 10);
    this.compressionEnabled = process.env.LOG_COMPRESSION !== 'false';
    this.cleanupInterval = null;
    this.compressionInterval = null;
  }

  /**
   * Initialize log management service
   */
  async initialize() {
    try {
      // Ensure logs directory exists
      await this.ensureDirectories();
      
      // Start periodic cleanup
      this.startCleanupSchedule();
      
      // Start compression schedule
      if (this.compressionEnabled) {
        this.startCompressionSchedule();
      }
      
      logger.info('Log management service initialized', {
        retentionDays: this.retentionDays,
        compressionEnabled: this.compressionEnabled
      });
    } catch (error) {
      logger.error('Failed to initialize log management service', { error: error.message });
    }
  }

  /**
   * Ensure log directories exist
   */
  async ensureDirectories() {
    const dirs = [
      this.logsDir,
      path.join(this.logsDir, 'audit'),
      path.join(this.logsDir, 'errors'),
      path.join(this.logsDir, 'archive')
    ];

    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        logger.debug('Created log directory', { directory: dir });
      }
    }
  }

  /**
   * Start cleanup schedule (daily at 2 AM)
   */
  startCleanupSchedule() {
    // Run cleanup immediately on startup
    this.cleanupOldLogs().catch(error => {
      logger.error('Initial log cleanup failed', { error: error.message });
    });

    // Schedule daily cleanup
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldLogs();
      } catch (error) {
        logger.error('Scheduled log cleanup failed', { error: error.message });
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Start compression schedule (daily at 3 AM)
   */
  startCompressionSchedule() {
    // Schedule daily compression
    this.compressionInterval = setInterval(async () => {
      try {
        await this.compressOldLogs();
      } catch (error) {
        logger.error('Scheduled log compression failed', { error: error.message });
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    logger.info('Starting log cleanup', { 
      cutoffDate: cutoffDate.toISOString(),
      retentionDays: this.retentionDays
    });

    let totalCleaned = 0;
    let totalSize = 0;

    try {
      const dirs = [
        this.logsDir,
        path.join(this.logsDir, 'audit'),
        path.join(this.logsDir, 'errors'),
        path.join(this.logsDir, 'archive')
      ];

      for (const dir of dirs) {
        const { filesRemoved, sizeFreed } = await this.cleanupDirectory(dir, cutoffDate);
        totalCleaned += filesRemoved;
        totalSize += sizeFreed;
      }

      logger.info('Log cleanup completed', {
        filesRemoved: totalCleaned,
        sizeFreed: this.formatBytes(totalSize),
        retentionDays: this.retentionDays
      });
    } catch (error) {
      logger.error('Log cleanup failed', { error: error.message });
    }
  }

  /**
   * Clean up directory
   */
  async cleanupDirectory(dirPath, cutoffDate) {
    let filesRemoved = 0;
    let sizeFreed = 0;

    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          sizeFreed += stats.size;
          await fs.unlink(filePath);
          filesRemoved++;
          
          logger.debug('Removed old log file', {
            file: filePath,
            size: this.formatBytes(stats.size),
            lastModified: stats.mtime.toISOString()
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup directory', { 
        directory: dirPath, 
        error: error.message 
      });
    }

    return { filesRemoved, sizeFreed };
  }

  /**
   * Compress old log files
   */
  async compressOldLogs() {
    const compressionAge = 1; // Compress logs older than 1 day
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - compressionAge);
    
    logger.info('Starting log compression', { 
      cutoffDate: cutoffDate.toISOString(),
      compressionAge
    });

    let totalCompressed = 0;
    let totalSaved = 0;

    try {
      const dirs = [
        this.logsDir,
        path.join(this.logsDir, 'audit'),
        path.join(this.logsDir, 'errors')
      ];

      for (const dir of dirs) {
        const { filesCompressed, spaceSaved } = await this.compressDirectory(dir, cutoffDate);
        totalCompressed += filesCompressed;
        totalSaved += spaceSaved;
      }

      logger.info('Log compression completed', {
        filesCompressed: totalCompressed,
        spaceSaved: this.formatBytes(totalSaved)
      });
    } catch (error) {
      logger.error('Log compression failed', { error: error.message });
    }
  }

  /**
   * Compress files in directory
   */
  async compressDirectory(dirPath, cutoffDate) {
    let filesCompressed = 0;
    let spaceSaved = 0;

    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        // Skip already compressed files
        if (file.endsWith('.gz')) continue;
        
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          const originalSize = stats.size;
          const compressedPath = `${filePath}.gz`;
          
          try {
            await this.compressFile(filePath, compressedPath);
            await fs.unlink(filePath); // Remove original file
            
            const compressedStats = await fs.stat(compressedPath);
            spaceSaved += originalSize - compressedStats.size;
            filesCompressed++;
            
            logger.debug('Compressed log file', {
              original: filePath,
              compressed: compressedPath,
              originalSize: this.formatBytes(originalSize),
              compressedSize: this.formatBytes(compressedStats.size),
              compressionRatio: Math.round((1 - compressedStats.size / originalSize) * 100)
            });
          } catch (error) {
            logger.error('Failed to compress file', { 
              file: filePath, 
              error: error.message 
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to compress directory', { 
        directory: dirPath, 
        error: error.message 
      });
    }

    return { filesCompressed, spaceSaved };
  }

  /**
   * Compress a single file
   */
  async compressFile(inputPath, outputPath) {
    const gzip = createGzip();
    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);
    
    await pipeline(source, gzip, destination);
  }

  /**
   * Get log statistics
   */
  async getLogStatistics() {
    const stats = {
      directories: {},
      totalSize: 0,
      totalFiles: 0,
      oldestLog: null,
      newestLog: null
    };

    try {
      const dirs = ['logs', 'audit', 'errors', 'archive'];
      
      for (const dir of dirs) {
        const dirPath = path.join(this.logsDir, dir === 'logs' ? '' : dir);
        const dirStats = await this.getDirectoryStats(dirPath);
        
        stats.directories[dir] = dirStats;
        stats.totalSize += dirStats.totalSize;
        stats.totalFiles += dirStats.fileCount;
        
        // Update oldest and newest
        if (dirStats.oldestFile && (!stats.oldestLog || dirStats.oldestFile < stats.oldestLog)) {
          stats.oldestLog = dirStats.oldestFile;
        }
        if (dirStats.newestFile && (!stats.newestLog || dirStats.newestFile > stats.newestLog)) {
          stats.newestLog = dirStats.newestFile;
        }
      }
      
      // Format sizes
      stats.totalSizeFormatted = this.formatBytes(stats.totalSize);
      Object.keys(stats.directories).forEach(dir => {
        stats.directories[dir].totalSizeFormatted = this.formatBytes(stats.directories[dir].totalSize);
      });
      
    } catch (error) {
      logger.error('Failed to get log statistics', { error: error.message });
    }

    return stats;
  }

  /**
   * Get directory statistics
   */
  async getDirectoryStats(dirPath) {
    const stats = {
      fileCount: 0,
      totalSize: 0,
      compressedFiles: 0,
      oldestFile: null,
      newestFile: null
    };

    try {
      await fs.access(dirPath);
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStats = await fs.stat(filePath);
        
        if (fileStats.isFile()) {
          stats.fileCount++;
          stats.totalSize += fileStats.size;
          
          if (file.endsWith('.gz')) {
            stats.compressedFiles++;
          }
          
          if (!stats.oldestFile || fileStats.mtime < stats.oldestFile) {
            stats.oldestFile = fileStats.mtime;
          }
          if (!stats.newestFile || fileStats.mtime > stats.newestFile) {
            stats.newestFile = fileStats.mtime;
          }
        }
      }
    } catch (error) {
      // Directory might not exist
    }

    return stats;
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Archive logs to external storage (placeholder)
   */
  async archiveLogs(destination) {
    // This would implement shipping logs to external storage
    // (S3, CloudWatch, ELK stack, etc.)
    logger.info('Log archiving requested', { destination });
    
    // Placeholder implementation
    throw new Error('Log archiving not implemented');
  }

  /**
   * Shutdown log management service
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.compressionInterval) {
      clearInterval(this.compressionInterval);
      this.compressionInterval = null;
    }
    
    logger.info('Log management service shutdown');
  }
}

module.exports = new LogManagementService();
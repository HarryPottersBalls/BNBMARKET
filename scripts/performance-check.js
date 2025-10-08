const v8 = require('v8');
const logger = require('../config/logger');

function checkMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();

  logger.info('Memory Usage:', {
    rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    totalHeapSize: `${(heapStats.total_heap_size / 1024 / 1024).toFixed(2)} MB`,
    usedHeapSize: `${(heapStats.used_heap_size / 1024 / 1024).toFixed(2)} MB`
  });

  if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8) {
    logger.warn('High memory usage detected. Consider optimizing or scaling.');
  }
}

module.exports = {
  checkMemoryUsage
};
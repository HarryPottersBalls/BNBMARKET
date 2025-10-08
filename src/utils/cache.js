const Redis = require('ioredis');
const crypto = require('crypto');

class CacheService {
  constructor(config) {
    // Configure Redis connection
    this.redis = new Redis({
      host: config.redis.host || 'localhost',
      port: config.redis.port || 6379,
      password: config.redis.password,
      db: config.redis.db || 0
    });

    // Prefix for all cache keys
    this.prefix = 'bnbmarket:';
  }

  // Generate a consistent cache key
  _getCacheKey(key) {
    return this.prefix + (typeof key === 'object'
      ? crypto.createHash('md5').update(JSON.stringify(key)).digest('hex')
      : key);
  }

  // Cache a value with optional TTL
  async set(key, value, ttl = 3600) {
    const cacheKey = this._getCacheKey(key);

    // Serialize value
    const serializedValue = JSON.stringify(value);

    await this.redis.set(cacheKey, serializedValue, 'EX', ttl);
  }

  // Retrieve a cached value
  async get(key) {
    const cacheKey = this._getCacheKey(key);
    const cachedValue = await this.redis.get(cacheKey);

    return cachedValue ? JSON.parse(cachedValue) : null;
  }

  // Delete a cached value
  async delete(key) {
    const cacheKey = this._getCacheKey(key);
    await this.redis.del(cacheKey);
  }

  // Memoize a function with caching
  memoize(fn, ttl = 3600) {
    return async (...args) => {
      const cacheKey = this._getCacheKey(args);

      // Try to get cached result
      const cachedResult = await this.get(cacheKey);
      if (cachedResult !== null) {
        return cachedResult;
      }

      // Execute function and cache result
      const result = await fn(...args);
      await this.set(cacheKey, result, ttl);

      return result;
    };
  }

  // Distributed lock for preventing cache stampede
  async lock(key, ttl = 10) {
    const lockKey = `lock:${this._getCacheKey(key)}`;

    // Try to acquire lock
    const acquired = await this.redis.set(
      lockKey,
      'locked',
      'NX',
      'EX',
      ttl
    );

    return acquired === 'OK';
  }

  // Release distributed lock
  async unlock(key) {
    const lockKey = `lock:${this._getCacheKey(key)}`;
    await this.redis.del(lockKey);
  }

  // Cache-aside pattern with locking
  async fetch(key, fetchFn, ttl = 3600) {
    const cacheKey = this._getCacheKey(key);

    // Check cache first
    const cachedValue = await this.get(cacheKey);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // Attempt to acquire lock
    const lockAcquired = await this.lock(cacheKey);

    try {
      if (lockAcquired) {
        // Fetch and cache value
        const freshValue = await fetchFn();
        await this.set(cacheKey, freshValue, ttl);
        return freshValue;
      } else {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.fetch(key, fetchFn, ttl);
      }
    } finally {
      if (lockAcquired) {
        await this.unlock(cacheKey);
      }
    }
  }

  // Close Redis connection
  async disconnect() {
    await this.redis.quit();
  }
}

module.exports = CacheService;
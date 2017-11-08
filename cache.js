const l = module.exports

const defaultTTL = 10 // in sec
let cache

// avoid reinitialization during  tests
let initialized = false

l.initialize = () => {
    if (initialized) return Promise.resolve()

    const cacheManager = require('cache-manager'),
        redisStore = require('cache-manager-redis-store')

    cache = cacheManager.caching({
        store: redisStore,
        host: 'redis',
        db: 0,
        ttl: 600
    })

    initialized  = true
}

l.close = () => {
    cache.store.getClient().quit()
    return Promise.resolve()
}

l.set = (key, val, ttl) => {
    return new Promise(function(resolve, reject) {
        cache.set(key, val, ttl || defaultTTL, function(err) {
            if(err) return reject(err)
            resolve(val)
        })
    })
}

l.get = (key) => {
    return new Promise(function(resolve, reject) {
        cache.get(key, function(err, val) {
            if(err) return reject(err)
            resolve(val)
        })
    })
}

l.del = (key) => {
    return new Promise(function(resolve, reject) {
        cache.del(key, function(err) {
            if(err) return reject(err)
            resolve()
        })
    })
}

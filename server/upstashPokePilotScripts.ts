export const admitRequestScript = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local eventId = ARGV[3]
local clientLimit = tonumber(ARGV[4])
local ipLimit = tonumber(ARGV[5])
local cutoff = now - windowMs

local function retryAfter(key, limit)
  redis.call("ZREMRANGEBYSCORE", key, "-inf", cutoff)
  if redis.call("ZCARD", key) < limit then
    return 0
  end
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  if #oldest < 2 then
    return 1
  end
  return math.max(1, tonumber(oldest[2]) + windowMs - now)
end

local clientRetryMs = retryAfter(KEYS[1], clientLimit)
local ipRetryMs = retryAfter(KEYS[2], ipLimit)
if clientRetryMs > 0 or ipRetryMs > 0 then
  if clientRetryMs >= ipRetryMs then
    return { 0, math.ceil(clientRetryMs), 1 }
  end
  return { 0, math.ceil(ipRetryMs), 2 }
end

redis.call("ZADD", KEYS[1], now, eventId)
redis.call("ZADD", KEYS[2], now, eventId)
redis.call("PEXPIRE", KEYS[1], windowMs)
redis.call("PEXPIRE", KEYS[2], windowMs)
return { 1, 0, 0 }
`;

export const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export const acquireWaiterScript = `
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local token = ARGV[3]
local keyLimit = tonumber(ARGV[4])
local totalLimit = tonumber(ARGV[5])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
redis.call("ZREMRANGEBYSCORE", KEYS[2], "-inf", now)
if redis.call("ZCARD", KEYS[1]) >= keyLimit or
   redis.call("ZCARD", KEYS[2]) >= totalLimit then
  return 0
end
redis.call("ZADD", KEYS[1], expiresAt, token)
redis.call("ZADD", KEYS[2], expiresAt, token)
redis.call("PEXPIRE", KEYS[1], expiresAt - now)
redis.call("PEXPIRE", KEYS[2], expiresAt - now)
return 1
`;

export const releaseWaiterScript = `
return {
  redis.call("ZREM", KEYS[1], ARGV[1]),
  redis.call("ZREM", KEYS[2], ARGV[1])
}
`;

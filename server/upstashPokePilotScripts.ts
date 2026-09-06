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

export const reserveRateLimitScript = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local eventId = ARGV[3]
local clientPolicy = cjson.decode(ARGV[4])
local ipPolicy = cjson.decode(ARGV[5])
local cutoff = now - windowMs

local function retryAfter(key, policy)
  redis.call("ZREMRANGEBYSCORE", key, "-inf", cutoff)
  local count = redis.call("ZCARD", key)
  local cooldownMs = 0

  for _, step in ipairs(policy.cooldownSteps) do
    if count >= tonumber(step.afterUses) then
      cooldownMs = tonumber(step.cooldownMs)
    end
  end

  local retryMs = 0
  if cooldownMs > 0 and count > 0 then
    local lastEvent = redis.call("ZRANGE", key, -1, -1, "WITHSCORES")
    if #lastEvent >= 2 then
      retryMs = math.max(0, tonumber(lastEvent[2]) + cooldownMs - now)
    end
  end

  if policy.burst then
    local burstWindowMs = tonumber(policy.burst.windowMs)
    local burstEvents = redis.call(
      "ZRANGEBYSCORE",
      key,
      "(" .. tostring(now - burstWindowMs),
      "+inf",
      "WITHSCORES"
    )
    local burstCount = #burstEvents / 2

    if burstCount >= tonumber(policy.burst.maxUses) and #burstEvents >= 2 then
      retryMs = math.max(
        retryMs,
        tonumber(burstEvents[2]) + burstWindowMs - now
      )
    end
  end

  return math.max(0, retryMs)
end

local clientRetryMs = retryAfter(KEYS[1], clientPolicy)
local ipRetryMs = retryAfter(KEYS[2], ipPolicy)

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

export const completeRateLimitReservationScript = `
local completedAt = tonumber(ARGV[1])
local eventId = ARGV[2]
local windowMs = tonumber(ARGV[3])
local clientPolicy = cjson.decode(ARGV[4])
local ipPolicy = cjson.decode(ARGV[5])
local cutoff = completedAt - windowMs

local clientUpdated = 0
local ipUpdated = 0

if redis.call("ZSCORE", KEYS[1], eventId) then
  redis.call("ZADD", KEYS[1], "XX", completedAt, eventId)
  clientUpdated = 1
end
if redis.call("ZSCORE", KEYS[2], eventId) then
  redis.call("ZADD", KEYS[2], "XX", completedAt, eventId)
  ipUpdated = 1
end

if clientUpdated > 0 then
  redis.call("PEXPIRE", KEYS[1], windowMs)
end
if ipUpdated > 0 then
  redis.call("PEXPIRE", KEYS[2], windowMs)
end

if clientUpdated == 0 and ipUpdated == 0 then
  return { clientUpdated, ipUpdated, 0, 0 }
end

local function retryAfter(key, policy)
  redis.call("ZREMRANGEBYSCORE", key, "-inf", cutoff)
  local count = redis.call("ZCARD", key)
  local cooldownMs = 0

  for _, step in ipairs(policy.cooldownSteps) do
    if count >= tonumber(step.afterUses) then
      cooldownMs = tonumber(step.cooldownMs)
    end
  end

  local retryMs = 0
  if cooldownMs > 0 and count > 0 then
    local lastEvent = redis.call("ZRANGE", key, -1, -1, "WITHSCORES")
    if #lastEvent >= 2 then
      retryMs = math.max(
        0,
        tonumber(lastEvent[2]) + cooldownMs - completedAt
      )
    end
  end

  if policy.burst then
    local burstWindowMs = tonumber(policy.burst.windowMs)
    local burstEvents = redis.call(
      "ZRANGEBYSCORE",
      key,
      "(" .. tostring(completedAt - burstWindowMs),
      "+inf",
      "WITHSCORES"
    )
    local burstCount = #burstEvents / 2

    if burstCount >= tonumber(policy.burst.maxUses) and #burstEvents >= 2 then
      retryMs = math.max(
        retryMs,
        tonumber(burstEvents[2]) + burstWindowMs - completedAt
      )
    end
  end

  return math.max(0, retryMs)
end

local clientRetryMs = retryAfter(KEYS[1], clientPolicy)
local ipRetryMs = retryAfter(KEYS[2], ipPolicy)

if clientRetryMs <= 0 and ipRetryMs <= 0 then
  return { clientUpdated, ipUpdated, 0, 0 }
end
if clientRetryMs >= ipRetryMs then
  return { clientUpdated, ipUpdated, math.ceil(clientRetryMs), 1 }
end
return { clientUpdated, ipUpdated, math.ceil(ipRetryMs), 2 }
`;

export const cancelRateLimitReservationScript = `
return {
  redis.call("ZREM", KEYS[1], ARGV[1]),
  redis.call("ZREM", KEYS[2], ARGV[1])
}
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

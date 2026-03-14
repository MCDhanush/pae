package database

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient wraps a redis.Client and provides JSON-aware helper methods.
type RedisClient struct {
	client *redis.Client
}

// NewRedisClient connects to Upstash Redis using the provided URL and token.
// The token is passed as the password for the default Redis user.
func NewRedisClient(ctx context.Context, redisURL, redisToken string) (*RedisClient, error) {

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("redis parse url: %w", err)
	}

	// Upstash uses the token as password
	opt.Password = redisToken

	// Upstash requires TLS
	opt.TLSConfig = &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	client := redis.NewClient(opt)

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	return &RedisClient{client: client}, nil
}

// Close closes the underlying Redis connection.
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// Client returns the underlying redis.Client.
func (r *RedisClient) Client() *redis.Client {
	return r.client
}

// SetJSON serialises value to JSON and stores it at key with the given TTL.
// Pass 0 for ttl to persist the key indefinitely.
func (r *RedisClient) SetJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("redis set json marshal: %w", err)
	}

	if err := r.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("redis set: %w", err)
	}

	return nil
}

// GetJSON retrieves the value at key and deserialises it into dest.
// Returns redis.Nil if the key does not exist.
func (r *RedisClient) GetJSON(ctx context.Context, key string, dest interface{}) error {
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return err // may be redis.Nil – callers should handle this
	}

	if err := json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("redis get json unmarshal: %w", err)
	}

	return nil
}

// Delete removes one or more keys from Redis.
func (r *RedisClient) Delete(ctx context.Context, keys ...string) error {
	if err := r.client.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("redis del: %w", err)
	}
	return nil
}

// Expire sets the TTL of an existing key.
func (r *RedisClient) Expire(ctx context.Context, key string, ttl time.Duration) error {
	if err := r.client.Expire(ctx, key, ttl).Err(); err != nil {
		return fmt.Errorf("redis expire: %w", err)
	}
	return nil
}

// HSet sets a hash field.
func (r *RedisClient) HSet(ctx context.Context, key, field string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("redis hset marshal: %w", err)
	}
	return r.client.HSet(ctx, key, field, data).Err()
}

// HGetAll returns all fields and values of a hash as a map of raw JSON bytes.
func (r *RedisClient) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return r.client.HGetAll(ctx, key).Result()
}

// HIncrBy atomically increments a hash field by incr and returns the new value.
func (r *RedisClient) HIncrBy(ctx context.Context, key, field string, incr int64) (int64, error) {
	return r.client.HIncrBy(ctx, key, field, incr).Result()
}

// ZAdd adds a member with a score to a sorted set.
func (r *RedisClient) ZAdd(ctx context.Context, key string, score float64, member string) error {
	return r.client.ZAdd(ctx, key, redis.Z{Score: score, Member: member}).Err()
}

// ZRevRangeWithScores returns top n members of a sorted set in descending order.
func (r *RedisClient) ZRevRangeWithScores(ctx context.Context, key string, count int64) ([]redis.Z, error) {
	return r.client.ZRevRangeWithScores(ctx, key, 0, count-1).Result()
}

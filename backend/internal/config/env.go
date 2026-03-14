package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all environment variable values for the application.
type Config struct {
	Port                         string
	MongoURI                     string
	RedisURL                     string
	RedisToken                   string
	JWTSecret                    string
	FirebaseBucket               string
	GoogleApplicationCredentials string
	FrontendURL                  string

	// MQTT / HiveMQ
	HiveMQBrokerURL string // e.g. tcp://broker.hivemq.com:1883
	HiveMQUsername  string // optional for public broker
	HiveMQPassword  string // optional for public broker
}

// Load reads environment variables from the .env file (if present) and returns
// a populated Config struct. Missing required variables will cause a fatal log.
func Load() *Config {
	// Attempt to load .env file; ignore error if file does not exist (e.g. in
	// production where env vars are injected by the runtime).
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading environment variables from OS")
	}

	cfg := &Config{
		Port:                         getEnv("PORT", "8080"),
		MongoURI:                     requireEnv("MONGO_URI"),
		RedisURL:                     requireEnv("REDIS_URL"),
		RedisToken:                   requireEnv("REDIS_TOKEN"),
		JWTSecret:                    requireEnv("JWT_SECRET"),
		FirebaseBucket:               getEnv("FirebaseBucket", ""),
		GoogleApplicationCredentials: getEnv("GOOGLE_APPLICATION_CREDENTIALS", ""),
		FrontendURL:                  getEnv("FRONTEND_URL", "http://localhost:5173"),

		HiveMQBrokerURL: getEnv("HIVEMQ_BROKER_URL", "tcp://broker.hivemq.com:1883"),
		HiveMQUsername:  getEnv("HIVEMQ_USERNAME", ""),
		HiveMQPassword:  getEnv("HIVEMQ_PASSWORD", ""),
	}

	return cfg
}

// getEnv returns the value of the environment variable identified by key.
// If the variable is not set it returns the provided fallback value.
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

// requireEnv returns the value of the environment variable identified by key.
// If the variable is not set the application will exit with a fatal log message.
func requireEnv(key string) string {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		log.Fatalf("required environment variable %q is not set", key)
	}
	return value
}

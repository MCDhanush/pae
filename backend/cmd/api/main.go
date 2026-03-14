package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"go.uber.org/zap"

	"github.com/pae/backend/internal/analytics"
	"github.com/pae/backend/internal/auth"
	"github.com/pae/backend/internal/config"
	"github.com/pae/backend/internal/database"
	"github.com/pae/backend/internal/events"
	"github.com/pae/backend/internal/game"
	"github.com/pae/backend/internal/middleware"
	"github.com/pae/backend/internal/platform"
	"github.com/pae/backend/internal/player"
	"github.com/pae/backend/internal/quiz"
	"github.com/pae/backend/internal/session"
	"github.com/pae/backend/internal/storage"
)

func main() {
	// -------------------------------------------------------------------------
	// Logger
	// -------------------------------------------------------------------------
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync() //nolint:errcheck

	// -------------------------------------------------------------------------
	// Config
	// -------------------------------------------------------------------------
	cfg := config.Load()
	logger.Info("configuration loaded", zap.String("port", cfg.Port))

	// -------------------------------------------------------------------------
	// Database connections
	// -------------------------------------------------------------------------
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db, err := database.NewDatabase(ctx, cfg.MongoURI)
	if err != nil {
		logger.Fatal("failed to connect to MongoDB", zap.Error(err))
	}
	defer db.Close(context.Background()) //nolint:errcheck
	logger.Info("connected to MongoDB")

	redisClient, err := database.NewRedisClient(ctx, cfg.RedisURL, cfg.RedisToken)
	if err != nil {
		logger.Fatal("failed to connect to Redis", zap.Error(err))
	}
	defer redisClient.Close() //nolint:errcheck
	logger.Info("connected to Redis")

	// -------------------------------------------------------------------------
	// Optional GCS client
	// -------------------------------------------------------------------------
	var gcsClient *storage.GCSClient
	if cfg.FirebaseBucket != "" {
		gcsClient, err = storage.NewGCSClient(context.Background(), cfg.FirebaseBucket, cfg.GoogleApplicationCredentials)
		if err != nil {
			logger.Warn("Firebase Storage client init failed – image upload disabled", zap.Error(err))
		} else {
			logger.Info("Firebase Storage client initialised", zap.String("bucket", cfg.FirebaseBucket))
			defer gcsClient.Close() //nolint:errcheck
		}
	}

	// -------------------------------------------------------------------------
	// MQTT / HiveMQ publisher
	// -------------------------------------------------------------------------
	clientID := fmt.Sprintf("pae-backend-%d", time.Now().UnixNano())
	mqttPublisher, err := events.NewMQTTPublisher(
		cfg.HiveMQBrokerURL,
		cfg.HiveMQUsername,
		cfg.HiveMQPassword,
		clientID,
		logger,
	)
	if err != nil {
		logger.Fatal("failed to connect to MQTT broker", zap.Error(err))
	}
	defer mqttPublisher.Close()
	logger.Info("MQTT publisher ready", zap.String("broker", cfg.HiveMQBrokerURL))

	// -------------------------------------------------------------------------
	// Repositories
	// -------------------------------------------------------------------------
	authRepo := auth.NewRepository(db.Users())
	quizRepo := quiz.NewRepository(db.Quizzes())
	gameRepo := game.NewRepository(db.QuizSessions())
	playerRepo := player.NewRepository(db.Players())

	// -------------------------------------------------------------------------
	// Services
	// -------------------------------------------------------------------------
	authService := auth.NewService(authRepo, cfg.JWTSecret)
	quizService := quiz.NewService(quizRepo)
	gameService := game.NewService(gameRepo, quizRepo, playerRepo, mqttPublisher, logger)
	playerService := player.NewService(playerRepo, gameService, quizRepo, mqttPublisher, redisClient)
	playerService.WithSessionByIDFinder(gameRepo)

	sessionService := session.NewService(gameRepo, playerRepo)

	platformService := platform.NewService(
		db.PlatformStats(),
		db.Users(),
		quizRepo,
		gameRepo,
		playerRepo,
	)

	analyticsService := analytics.NewService(db.Players(), db.QuizSessions(), db.Quizzes())

	// -------------------------------------------------------------------------
	// HTTP Handlers
	// -------------------------------------------------------------------------
	authHandler := auth.NewHandler(authService)
	quizHandler := quiz.NewHandler(quizService, gcsClient)
	gameHandler := game.NewHandler(gameService, playerRepo)
	playerHandler := player.NewHandlerWithSecret(playerService, cfg.JWTSecret)
	sessionHandler := session.NewHandler(sessionService)
	platformHandler := platform.NewHandler(platformService)
	analyticsHandler := analytics.NewHandler(analyticsService)

	// -------------------------------------------------------------------------
	// Router
	// -------------------------------------------------------------------------
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.Logger(logger))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "https://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Auth routes (public)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireAuth(cfg.JWTSecret))
				r.Get("/me", authHandler.Me)
				r.Put("/profile", authHandler.UpdateProfile)
			})
		})

		// Quiz routes
		r.Route("/quizzes", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.JWTSecret))
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireTeacher(cfg.JWTSecret))
				r.Post("/", quizHandler.CreateQuiz)
				r.Get("/", quizHandler.ListQuizzes)
				// General image upload – no quiz ID required; must be before /{id} pattern
				r.Post("/images", quizHandler.UploadImageGeneral)
			})
			r.Get("/{id}", quizHandler.GetQuiz)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireTeacher(cfg.JWTSecret))
				r.Put("/{id}", quizHandler.UpdateQuiz)
				r.Delete("/{id}", quizHandler.DeleteQuiz)
				r.Post("/{id}/upload-image", quizHandler.UploadImage)
				r.Put("/{id}/publish", quizHandler.PublishQuiz)
			})
		})

		// Marketplace – public browse, auth required for copy
		r.Route("/marketplace", func(r chi.Router) {
			r.Get("/", quizHandler.ListMarketplace)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireTeacher(cfg.JWTSecret))
				r.Post("/{id}/copy", quizHandler.CopyMarketplaceQuiz)
			})
		})

		// Game session routes
		r.Route("/game/sessions", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireTeacher(cfg.JWTSecret))
				r.Post("/", gameHandler.CreateSession)
			})
			r.Get("/{pin}", gameHandler.GetSessionByPIN)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireTeacher(cfg.JWTSecret))
				r.Post("/{pin}/start", gameHandler.StartSession)
				r.Post("/{pin}/next", gameHandler.NextQuestion)
				r.Post("/{pin}/end", gameHandler.EndSession)
			})
			r.Get("/{pin}/leaderboard", gameHandler.Leaderboard)
		})

		// Player routes – public, with optional auth on /my-attempts
		r.Route("/players", func(r chi.Router) {
			r.Post("/join", playerHandler.Join)
			r.Post("/{player_id}/answer", playerHandler.SubmitAnswer)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireAuth(cfg.JWTSecret))
				r.Get("/my-attempts", playerHandler.GetMyAttempts)
			})
		})

		// Session history – teacher only
		r.Route("/sessions", func(r chi.Router) {
			r.Use(middleware.RequireTeacher(cfg.JWTSecret))
			r.Get("/", sessionHandler.ListSessions)
			r.Get("/{id}", sessionHandler.GetSession)
			r.Get("/{id}/players", sessionHandler.GetPlayers)
		})

		// Platform stats – public
		r.Route("/platform", func(r chi.Router) {
			r.Get("/stats", platformHandler.Stats)
		})

		// Analytics – teacher auth required
		r.Route("/analytics", func(r chi.Router) {
			r.Use(middleware.RequireTeacher(cfg.JWTSecret))
			r.Get("/overview", analyticsHandler.GetOverview)
			r.Get("/sessions/{id}", analyticsHandler.GetSessionAnalytics)
			r.Get("/quizzes/{id}", analyticsHandler.GetQuizAnalytics)
		})
	})

	// -------------------------------------------------------------------------
	// HTTP server with graceful shutdown
	// -------------------------------------------------------------------------
	addr := ":" + cfg.Port
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("HTTP server starting", zap.String("addr", addr))
		serverErrors <- srv.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		if err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}

	case sig := <-quit:
		logger.Info("shutdown signal received", zap.String("signal", sig.String()))

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			logger.Error("graceful shutdown failed", zap.Error(err))
		} else {
			logger.Info("server shut down gracefully")
		}
	}
}

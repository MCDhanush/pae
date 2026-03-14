package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/storage"
	"google.golang.org/api/option"
)

const maxFileSize = 2 << 20 // 2 MB

// ErrFileTooLarge is returned when the uploaded file exceeds the size limit.
var ErrFileTooLarge = errors.New("file exceeds the 2 MB limit")

// GCSClient wraps a Firebase Storage client. The name is kept the same so
// nothing else in the codebase needs to change.
type GCSClient struct {
	storageClient *storage.Client
	bucket        string
}

// NewGCSClient creates a GCSClient backed by Firebase Storage.
// credentialsFile is the path to your Firebase service-account JSON.
// If empty, Application Default Credentials are used.
func NewGCSClient(ctx context.Context, bucket string, credentialsFile string) (*GCSClient, error) {
	var opts []option.ClientOption
	if credentialsFile != "" {
		opts = append(opts, option.WithCredentialsFile(credentialsFile))
	}

	app, err := firebase.NewApp(ctx, &firebase.Config{
		StorageBucket: bucket,
	}, opts...)
	if err != nil {
		return nil, fmt.Errorf("firebase new app: %w", err)
	}

	client, err := app.Storage(ctx)
	if err != nil {
		return nil, fmt.Errorf("firebase storage client: %w", err)
	}

	return &GCSClient{storageClient: client, bucket: bucket}, nil
}

// Upload reads the file, validates its size, and stores it in Firebase Storage
// under a timestamped path. Returns the public HTTPS URL of the uploaded object.
func (g *GCSClient) Upload(ctx context.Context, file multipart.File, filename, contentType string) (string, error) {
	// Read into memory to enforce the size limit.
	data, err := io.ReadAll(io.LimitReader(file, maxFileSize+1))
	if err != nil {
		return "", fmt.Errorf("firebase read file: %w", err)
	}
	if int64(len(data)) > maxFileSize {
		return "", ErrFileTooLarge
	}

	// Build a unique object name: timestamp + original filename.
	ext := filepath.Ext(filename)
	base := filename[:len(filename)-len(ext)]
	objectName := fmt.Sprintf("quizzes/%d-%s%s", time.Now().UnixNano(), base, ext)

	bkt, err := g.storageClient.DefaultBucket()
	if err != nil {
		return "", fmt.Errorf("firebase default bucket: %w", err)
	}

	obj := bkt.Object(objectName)
	w := obj.NewWriter(ctx)
	w.ContentType = contentType
	// Make the object publicly readable so we can return a direct URL.
	w.PredefinedACL = "publicRead"

	if _, err := w.Write(data); err != nil {
		_ = w.Close()
		return "", fmt.Errorf("firebase write: %w", err)
	}
	if err := w.Close(); err != nil {
		return "", fmt.Errorf("firebase close writer: %w", err)
	}

	// Firebase Storage objects are served from the same GCS public URL.
	publicURL := fmt.Sprintf(
		"https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media",
		g.bucket,
		objectName,
	)
	return publicURL, nil
}

// Delete removes an object from the Firebase Storage bucket.
func (g *GCSClient) Delete(ctx context.Context, objectName string) error {
	bkt, err := g.storageClient.DefaultBucket()
	if err != nil {
		return fmt.Errorf("firebase default bucket: %w", err)
	}
	if err := bkt.Object(objectName).Delete(ctx); err != nil {
		return fmt.Errorf("firebase delete: %w", err)
	}
	return nil
}

// Close is a no-op for the Firebase client (kept for interface compatibility).
func (g *GCSClient) Close() error {
	return nil
}

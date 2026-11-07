package storage

import (
	"context"
	"fmt"
	"time"

	gcs "cloud.google.com/go/storage"
)

// Service wraps the Google Cloud Storage client
type Service struct {
	client     *gcs.Client
	bucketName string
}

// NewService creates a new Cloud Storage service instance
func NewService(client *gcs.Client, bucketName string) *Service {
	return &Service{
		client:     client,
		bucketName: bucketName,
	}
}

// GenerateUploadSignedURL creates a 15-minute write-only V4 signed PUT URL.
// The browser uses this URL to upload the high-definition video directly to
// Google Cloud Storage, completely bypassing the Go application server RAM and CPU.
func (s *Service) GenerateUploadSignedURL(ctx context.Context, estimateID, contentType string) (string, string, error) {
	if s.client == nil {
		// Mock URL if running locally without GCP credentials
		return fmt.Sprintf("/mock-upload/%s", estimateID), fmt.Sprintf("estimates/%s/mock_video.mp4", estimateID), nil
	}

	objectKey := fmt.Sprintf("estimates/%s/walkaround_%d.mp4", estimateID, time.Now().Unix())

	opts := &gcs.SignedURLOptions{
		Scheme:  gcs.SigningSchemeV4,
		Method:  "PUT",
		Expires: time.Now().Add(15 * time.Minute),
		Headers: []string{
			fmt.Sprintf("Content-Type: %s", contentType),
		},
	}

	signedURL, err := s.client.Bucket(s.bucketName).SignedURL(objectKey, opts)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate signed upload URL: %w", err)
	}

	return signedURL, objectKey, nil
}

// GeneratePlaybackSignedURL creates a short-lived read-only GET signed URL
// for the customer to securely stream the video directly from Cloud Storage.
func (s *Service) GeneratePlaybackSignedURL(ctx context.Context, objectKey string) (string, error) {
	if s.client == nil || objectKey == "" {
		return "", nil
	}

	opts := &gcs.SignedURLOptions{
		Scheme:  gcs.SigningSchemeV4,
		Method:  "GET",
		Expires: time.Now().Add(2 * time.Hour),
	}

	url, err := s.client.Bucket(s.bucketName).SignedURL(objectKey, opts)
	if err != nil {
		return "", fmt.Errorf("failed to generate playback URL: %w", err)
	}

	return url, nil
}

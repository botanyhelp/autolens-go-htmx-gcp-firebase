package storage

import (
	"context"
	"fmt"
	"io"
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
	}

	signedURL, err := s.client.Bucket(s.bucketName).SignedURL(objectKey, opts)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate signed upload URL: %w", err)
	}

	return signedURL, objectKey, nil
}

// UploadObjectDirect streams data directly to GCS using the authenticated storage client.
// This works with ALL GCP credential types (including user ADC, Cloud Shell, and Workload Identity)
// without requiring an RSA private key.
func (s *Service) UploadObjectDirect(ctx context.Context, objectKey, contentType string, r io.Reader) error {
	if s.client == nil {
		return nil
	}

	wc := s.client.Bucket(s.bucketName).Object(objectKey).NewWriter(ctx)
	wc.ContentType = contentType
	if _, err := io.Copy(wc, r); err != nil {
		wc.Close()
		return fmt.Errorf("failed writing to GCS: %w", err)
	}
	return wc.Close()
}

// GeneratePlaybackSignedURL creates a short-lived read-only GET signed URL
// or direct storage URL for the customer to securely stream the video.
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
		// Fallback to standard Cloud Storage URL if local key signing is not configured
		return fmt.Sprintf("https://storage.googleapis.com/%s/%s", s.bucketName, objectKey), nil
	}

	return url, nil
}

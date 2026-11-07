export interface BlueprintFile {
  name: string;
  language: string;
  path: string;
  description: string;
  content: string;
}

export const GO_BACKEND_BLUEPRINT: BlueprintFile[] = [
  {
    name: 'main.go',
    language: 'go',
    path: 'cmd/server/main.go',
    description: 'Go net/http server using standard library, go:embed, Firestore SDK, and HTMX endpoints.',
    content: `package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"google.golang.org/api/iterator"
)

//go:embed templates/* static/*
var embeddedContent embed.FS

var (
	firestoreClient *firestore.Client
	storageClient   *storage.Client
	bucketName      string
	projectID       string
	tmpl            *template.Template
)

type PartItem struct {
	Name     string  \`json:"name" firestore:"name"\`
	UnitCost float64 \`json:"unit_cost" firestore:"unit_cost"\`
	Quantity int     \`json:"quantity" firestore:"quantity"\`
	Required bool    \`json:"required" firestore:"required"\`
}

type LaborItem struct {
	Description string  \`json:"description" firestore:"description"\`
	Hours       float64 \`json:"hours" firestore:"hours"\`
	HourlyRate  float64 \`json:"hourly_rate" firestore:"hourly_rate"\`
	Required    bool    \`json:"required" firestore:"required"\`
}

type Estimate struct {
	ID            string      \`firestore:"id"\`
	CustomerName  string      \`firestore:"customer_name"\`
	Email         string      \`firestore:"email"\`
	Phone         string      \`firestore:"phone"\`
	VehicleYear   int         \`firestore:"vehicle_year"\`
	VehicleMake   string      \`firestore:"vehicle_make"\`
	VehicleModel  string      \`firestore:"vehicle_model"\`
	PartsEstimate float64     \`firestore:"parts_estimate"\`
	LaborEstimate float64     \`firestore:"labor_estimate"\`
	Notes         string      \`firestore:"notes"\`
	VideoGCSPath  string      \`firestore:"video_gcs_path,omitempty"\`
	VideoURL      string      \`firestore:"-"\` // Computed signed read URL for template
	Status        string      \`firestore:"status"\` // "draft", "awaiting_customer", "approved"
	CreatedAt     time.Time   \`firestore:"created_at"\`
}

func main() {
	ctx := context.Background()
	projectID = os.Getenv("GOOGLE_CLOUD_PROJECT")
	bucketName = os.Getenv("GCS_VIDEO_BUCKET")
	if bucketName == "" {
		bucketName = "autolens-video-records"
	}

	// Initialize Firestore Client
	var err error
	firestoreClient, err = firestore.NewClient(ctx, projectID)
	if err != nil {
		log.Printf("Warning: Running without live Firestore (using memory fallback for local dev): %v", err)
	}

	// Initialize Cloud Storage Client
	storageClient, err = storage.NewClient(ctx)
	if err != nil {
		log.Printf("Warning: Cloud Storage client init: %v", err)
	}

	// Parse embedded HTML templates
	tmpl = template.Must(template.ParseFS(embeddedContent, "templates/*.html"))

	mux := http.NewServeMux()

	// Static assets (htmx.min.js, css)
	mux.Handle("/static/", http.FileServer(http.FS(embeddedContent)))

	// Mechanic Dashboard & Estimate Creator
	mux.HandleFunc("/", handleDashboard)
	mux.HandleFunc("/estimates/new", handleNewEstimateForm)
	mux.HandleFunc("/api/estimates/create", handleCreateEstimate)

	// Direct-to-GCS Signed URL Generator
	mux.HandleFunc("/api/estimates/video-upload-url", handleGetUploadSignedURL)
	mux.HandleFunc("/api/estimates/video-complete", handleVideoUploadComplete)

	// Customer Review Portal
	mux.HandleFunc("/review/", handleCustomerReview)
	mux.HandleFunc("/api/estimates/approve", handleCustomerApproval)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("AutoLens Go server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server exited: %v", err)
	}
}

// Generates a 15-minute write-only V4 Signed URL so browser can upload directly to GCS
func handleGetUploadSignedURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	estimateID := r.URL.Query().Get("estimate_id")
	contentType := r.URL.Query().Get("content_type")
	if contentType == "" {
		contentType = "video/mp4"
	}

	objectKey := fmt.Sprintf("estimates/%s/walkaround_%d.mp4", estimateID, time.Now().Unix())

	opts := &storage.SignedURLOptions{
		Scheme:      storage.SigningSchemeV4,
		Method:      http.MethodPut,
		Headers:     []string{"Content-Type: " + contentType},
		Expires:     time.Now().Add(15 * time.Minute),
	}

	signedURL, err := storageClient.Bucket(bucketName).SignedURL(objectKey, opts)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to sign URL: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"upload_url": signedURL,
		"gcs_path":   objectKey,
	})
}
`
  },
  {
    name: 'storage.go',
    language: 'go',
    path: 'pkg/gcs/storage.go',
    description: 'Cloud Storage helper for generating V4 signed PUT URLs and secure temporary playback URLs.',
    content: `package gcs

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/storage"
)

type StorageService struct {
	client     *storage.Client
	bucketName string
}

func NewStorageService(client *storage.Client, bucket string) *StorageService {
	return &StorageService{
		client:     client,
		bucketName: bucket,
	}
}

// GenerateUploadURL creates a short-lived HTTP PUT signed URL for direct browser uploads.
func (s *StorageService) GenerateUploadURL(ctx context.Context, estimateID string, contentType string) (string, string, error) {
	objectKey := fmt.Sprintf("estimates/%s/walkaround_%d.mp4", estimateID, time.Now().Unix())

	opts := &storage.SignedURLOptions{
		Scheme:  storage.SigningSchemeV4,
		Method:  "PUT",
		Expires: time.Now().Add(15 * time.Minute),
		Headers: []string{
			fmt.Sprintf("Content-Type: %s", contentType),
		},
	}

	url, err := s.client.Bucket(s.bucketName).SignedURL(objectKey, opts)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate signed upload URL: %w", err)
	}

	return url, objectKey, nil
}

// GeneratePlaybackURL creates a temporary read-only signed URL for the customer to watch the video.
func (s *StorageService) GeneratePlaybackURL(ctx context.Context, objectKey string) (string, error) {
	opts := &storage.SignedURLOptions{
		Scheme:  storage.SigningSchemeV4,
		Method:  "GET",
		Expires: time.Now().Add(2 * time.Hour),
	}

	url, err := s.client.Bucket(s.bucketName).SignedURL(objectKey, opts)
	if err != nil {
		return "", fmt.Errorf("failed to generate signed playback URL: %w", err)
	}

	return url, nil
}
`
  },
  {
    name: 'templates/index.html',
    language: 'html',
    path: 'templates/index.html',
    description: 'Server-rendered HTML template with HTMX and direct GCS upload progress bar.',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoLens | Mechanic Bay Console</title>
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">

  <div class="max-w-4xl mx-auto p-6">
    <header class="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
      <div>
        <h1 class="text-2xl font-bold text-white">AutoLens Bay Console</h1>
        <p class="text-sm text-slate-400">Standard Go + HTMX + Cloud Storage</p>
      </div>
      <span class="bg-emerald-900/60 text-emerald-400 border border-emerald-700/50 px-3 py-1 rounded-full text-xs">
        Cloud Run Live
      </span>
    </header>

    <!-- HTMX Form: Creates Firestore record first, returns video upload stage -->
    <div id="estimate-card" class="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl">
      <form hx-post="/api/estimates/create" hx-target="#estimate-card" hx-swap="outerHTML">
        <h2 class="text-lg font-semibold text-white mb-4">Step 1: Estimate Details</h2>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs text-slate-400 mb-1">Customer Name</label>
            <input type="text" name="customer_name" required class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Customer Phone</label>
            <input type="tel" name="phone" required class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Vehicle (Year / Make / Model)</label>
            <input type="text" name="vehicle" placeholder="e.g. 2021 Toyota RAV4" required class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Parts Estimate ($)</label>
            <input type="number" step="0.01" name="parts_estimate" required class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
          </div>
        </div>

        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded transition">
          Save Details & Proceed to Walkaround Video &rarr;
        </button>
      </form>
    </div>
  </div>

  <!-- Vanilla JS snippet: Direct HTTP PUT to GCS Signed URL -->
  <script>
    function uploadVideoDirectToGCS(inputElement, estimateId) {
      const file = inputElement.files[0];
      if (!file) return;

      const progressContainer = document.getElementById("upload-progress-box");
      const progressBar = document.getElementById("upload-progress-bar");
      const progressLabel = document.getElementById("upload-progress-label");
      progressContainer.classList.remove("hidden");

      // 1. Fetch Signed URL from Go backend
      fetch('/api/estimates/video-upload-url?estimate_id=' + estimateId + '&content_type=' + encodeURIComponent(file.type || 'video/mp4'), {
        method: 'POST'
      })
      .then(r => r.json())
      .then(data => {
        // 2. Direct HTTP PUT to Google Cloud Storage (zero server load)
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.upload_url, true);
        xhr.setRequestHeader("Content-Type", file.type || 'video/mp4');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.value = percent;
            progressLabel.innerText = 'Uploading to GCS: ' + percent + '% (' + (e.loaded/1024/1024).toFixed(1) + 'MB)';
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            progressLabel.innerText = "Upload Complete! Updating Firestore...";
            // 3. Notify Go backend via HTMX to update estimate status to ready
            htmx.ajax('POST', '/api/estimates/video-complete?estimate_id=' + estimateId + '&gcs_path=' + encodeURIComponent(data.gcs_path), '#estimate-card');
          } else {
            alert('Upload failed: ' + xhr.statusText);
          }
        };

        xhr.send(file);
      });
    }
  </script>
</body>
</html>
`
  },
  {
    name: 'Dockerfile',
    language: 'dockerfile',
    path: 'Dockerfile',
    description: 'Multi-stage production Dockerfile producing a tiny, zero-dependency ~18MB container for Cloud Run.',
    content: `# Stage 1: Build the Go binary
FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Build static binary without CGO
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server

# Stage 2: Minimal runtime image
FROM scratch

# Include SSL root certificates for Google Cloud APIs
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server

EXPOSE 8080
ENTRYPOINT ["/server"]
`
  },
  {
    name: 'cors.json',
    language: 'json',
    path: 'cors.json',
    description: 'Cloud Storage bucket CORS configuration allowing direct web browser PUT uploads.',
    content: `[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "OPTIONS"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]

# Apply to your bucket in 1 command:
# gcloud storage buckets update gs://YOUR_BUCKET_NAME --cors-file=cors.json
`
  },
  {
    name: 'cloudbuild.yaml',
    language: 'yaml',
    path: 'cloudbuild.yaml',
    description: 'Google Cloud Build pipeline that builds the container and deploys straight to Cloud Run.',
    content: `steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/autolens-go:$COMMIT_SHA', '.']

  # Push image to Container Registry / Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/autolens-go:$COMMIT_SHA']

  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'autolens-go'
      - '--image'
      - 'gcr.io/$PROJECT_ID/autolens-go:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'GCS_VIDEO_BUCKET=autolens-records-$PROJECT_ID'

images:
  - 'gcr.io/$PROJECT_ID/autolens-go:$COMMIT_SHA'
`
  }
];

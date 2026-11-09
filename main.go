package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	gcs "cloud.google.com/go/storage"

	"autolens-repair-estimates/pkg/db"
	"autolens-repair-estimates/pkg/storage"
)

//go:embed templates/* static/*
var content embed.FS

var (
	repo           *db.Repository
	storageService *storage.Service
	gcsClient      *gcs.Client
	bucketName     string
	tmplFuncs      = template.FuncMap{
		"Multiply": func(a, b float64) float64 {
			return a * b
		},
		"float64": func(i int) float64 {
			return float64(i)
		},
	}
)

// detectGCPProjectID discovers the project ID from env vars or the GCP metadata server
func detectGCPProjectID() string {
	if id := os.Getenv("GOOGLE_CLOUD_PROJECT"); id != "" {
		return id
	}
	if id := os.Getenv("PROJECT_ID"); id != "" {
		return id
	}
	if id := os.Getenv("DEVSHELL_PROJECT_ID"); id != "" {
		return id
	}

	// Query Google Cloud Metadata Server (automatically available in Cloud Run & GKE)
	client := &http.Client{Timeout: 1500 * time.Millisecond}
	req, err := http.NewRequest("GET", "http://metadata.google.internal/computeMetadata/v1/project/project-id", nil)
	if err == nil {
		req.Header.Set("Metadata-Flavor", "Google")
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			if data, err := io.ReadAll(resp.Body); err == nil {
				id := strings.TrimSpace(string(data))
				if id != "" {
					return id
				}
			}
		}
	}
	return ""
}

func main() {
	ctx := context.Background()
	// Auto-detect project ID from env vars or GCP metadata server
	projectID := detectGCPProjectID()

	bucketName = os.Getenv("GCS_VIDEO_BUCKET")
	if bucketName == "" && projectID != "" {
		bucketName = fmt.Sprintf("autolens-records-%s", projectID)
	} else if bucketName == "" {
		bucketName = "autolens-video-records"
	}

	// Check for service account credentials
	credPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if credPath != "" {
		log.Printf("[Auth] ✅ Using Service Account key: %s", credPath)
	} else if kService := os.Getenv("K_SERVICE"); kService != "" {
		log.Printf("[Auth] ✅ Running on Cloud Run (service: %s). Authenticating via Cloud Run service account.", kService)
	} else {
		log.Printf("[Auth] ⚠️  GOOGLE_APPLICATION_CREDENTIALS is NOT set.")
		log.Printf("[Auth] ⚠️  In Cloud Shell, the Go runtime defaults to VM metadata, which lacks permissions on '%s'.", projectID)
		log.Printf("[Auth] 👉 To fix: Create and export a service account key (see instructions).")
	}

	// 1. Initialize Firestore client (with graceful local fallback)
	var firestoreClient *firestore.Client
	if projectID != "" {
		var err error
		firestoreClient, err = firestore.NewClient(ctx, projectID)
		if err != nil {
			log.Printf("[Firestore] ⚠️  Warning: Connected to project '%s' but Firestore is not initialized yet (%v).", projectID, err)
			log.Printf("[Firestore] 👉 To enable Firestore in this GCP project, run:")
			log.Printf("     gcloud firestore databases create --location=nam5 --type=firestore-native")
			log.Printf("[Firestore] Falling back to in-memory storage for now.")
		} else {
			log.Printf("[Firestore] ✅ Connected to GCP Firestore! Project: '%s', Collection: 'estimates'", projectID)
		}
	} else {
		log.Printf("[Firestore] ℹ️  GOOGLE_CLOUD_PROJECT not set. Running with built-in in-memory repository.")
		log.Printf("     Run 'export GOOGLE_CLOUD_PROJECT=your-project-id' to connect to live Firestore.")
	}
	repo = db.NewRepository(firestoreClient)

	// 2. Initialize Cloud Storage client (with graceful local fallback)
	var err error
	gcsClient, err = gcs.NewClient(ctx)
	if err != nil {
		log.Printf("[Cloud Storage] Notice: Could not connect to GCP Storage (%v). Using simulated signed URLs.", err)
	} else {
		log.Printf("[Cloud Storage] Connected to GCP Storage bucket: %s", bucketName)
	}
	storageService = storage.NewService(gcsClient, bucketName)

	// 3. Setup HTTP Routes
	mux := http.NewServeMux()

	// Static assets (htmx.min.js, style.css)
	mux.Handle("/static/", http.FileServer(http.FS(content)))

	// Mechanic Bay routes
	mux.HandleFunc("/", handleDashboard)
	mux.HandleFunc("/estimates/new", handleNewEstimate)
	mux.HandleFunc("/estimates/create", handleCreateEstimate)
	mux.HandleFunc("/estimates/", handleEstimateDetail)

	// Video Signed URL API routes (Direct-to-GCS upload + Stream fallback)
	mux.HandleFunc("/api/estimates/video-upload-url", handleGetUploadSignedURL)
	mux.HandleFunc("/api/estimates/video-upload-stream", handleVideoUploadStream)
	mux.HandleFunc("/api/estimates/video-complete", handleVideoUploadComplete)

	// Video Playback Stream Route (Serves directly from private GCS with HTTP Range support for scrubbing)
	mux.HandleFunc("/api/videos/stream", handleVideoStream)

	// Customer Review Portal routes
	mux.HandleFunc("/review/", handleCustomerReview)
	mux.HandleFunc("/api/estimates/approve", handleCustomerApprove)

	// 4. Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("=====================================================")
	log.Printf(" AutoLens Go Server running at: http://localhost:%s", port)
	log.Printf(" Direct-to-GCS Video & Firestore Car Repair Estimates")
	log.Printf("=====================================================")

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// Renders the main mechanic dashboard listing all work orders
func handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	ctx := r.Context()
	estimates, err := repo.ListAll(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	t, err := template.New("layout").Funcs(tmplFuncs).ParseFS(content, "templates/layout.html", "templates/dashboard.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"Estimates": estimates,
	}
	t.ExecuteTemplate(w, "layout", data)
}

// Renders the form to create a new estimate record
func handleNewEstimate(w http.ResponseWriter, r *http.Request) {
	t, err := template.New("layout").Funcs(tmplFuncs).ParseFS(content, "templates/layout.html", "templates/new_estimate.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	t.ExecuteTemplate(w, "layout", nil)
}

// Processes the new estimate form submission and saves to Firestore
func handleCreateEstimate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	id := fmt.Sprintf("est-%d", time.Now().Unix()%10000)
	year, _ := strconv.Atoi(r.FormValue("vehicle_year"))
	partsCost, _ := strconv.ParseFloat(r.FormValue("parts_cost"), 64)
	laborCost, _ := strconv.ParseFloat(r.FormValue("labor_cost"), 64)

	est := &db.Estimate{
		ID:             id,
		EstimateNumber: fmt.Sprintf("EST-2026-%d", time.Now().Unix()%10000),
		CustomerName:   r.FormValue("customer_name"),
		Email:          r.FormValue("email"),
		Phone:          r.FormValue("phone"),
		VehicleYear:    year,
		VehicleMake:    r.FormValue("vehicle_make"),
		VehicleModel:   r.FormValue("vehicle_model"),
		LicensePlate:   r.FormValue("license_plate"),
		Urgency:        r.FormValue("urgency"),
		MechanicName:   "Dave Miller (Master Tech)",
		ShopName:       "Apex Motor Works & Diagnostics",
		ShopPhone:      "(555) 742-8800",
		Notes:          r.FormValue("notes"),
		TaxRatePercent: 7.75,
		Status:         "awaiting_customer",
		CreatedAt:      time.Now(),
		Parts: []db.PartItem{
			{
				ID:       "p1",
				Name:     r.FormValue("part_name"),
				Quantity: 1,
				UnitCost: partsCost,
				Approved: true,
				Required: true,
			},
		},
		Labor: []db.LaborItem{
			{
				ID:          "l1",
				Description: r.FormValue("labor_desc"),
				Hours:       1.5,
				HourlyRate:  laborCost / 1.5,
				Approved:    true,
				Required:    true,
			},
		},
	}

	if err := repo.Save(r.Context(), est); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save estimate: %v", err), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/estimates/"+id, http.StatusSeeOther)
}

// Renders the single estimate detail and mechanic video upload bay
func handleEstimateDetail(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/estimates/")
	if id == "" {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	ctx := r.Context()
	est, err := repo.GetByID(ctx, id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	playbackURL, _ := storageService.GeneratePlaybackSignedURL(ctx, est.VideoGCSPath)

	t, err := template.New("layout").Funcs(tmplFuncs).ParseFS(content, "templates/layout.html", "templates/estimate_detail.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"Estimate":    est,
		"PlaybackURL": playbackURL,
		"BucketName":  bucketName,
		"Multiply": func(a, b float64) float64 {
			return a * b
		},
	}
	t.ExecuteTemplate(w, "layout", data)
}

// Direct-to-GCS: Returns a 15-minute write-only V4 Signed PUT URL, or indicates stream fallback
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

	w.Header().Set("Content-Type", "application/json")
	url, path, err := storageService.GenerateUploadSignedURL(r.Context(), estimateID, contentType)
	if err != nil {
		log.Printf("[Cloud Storage] ℹ️  Signed URL local key generation not available (%v). Switching to streaming GCS upload.", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"use_stream": true,
			"error":      err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"upload_url": url,
		"gcs_path":   path,
		"use_stream": false,
	})
}

// Fallback upload handler: Streams multipart video data directly into Google Cloud Storage
// using standard ADC credentials without requiring a private RSA signing key
func handleVideoUploadStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 500 MB max video limit
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		http.Error(w, "File too large or invalid multipart form", http.StatusBadRequest)
		return
	}

	estimateID := r.FormValue("estimate_id")
	file, header, err := r.FormFile("video")
	if err != nil {
		http.Error(w, "Missing video file in request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "video/mp4"
	}

	objectKey := fmt.Sprintf("estimates/%s/walkaround_%d.mp4", estimateID, time.Now().Unix())
	log.Printf("[Cloud Storage] Streaming video '%s' (%d bytes) directly to GCS bucket '%s'...", header.Filename, header.Size, bucketName)

	if err := storageService.UploadObjectDirect(r.Context(), objectKey, contentType, file); err != nil {
		log.Printf("[Cloud Storage] ⚠️ GCS direct upload error: %v", err)
		http.Error(w, fmt.Sprintf("Cloud Storage upload failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Update Firestore
	ctx := r.Context()
	est, err := repo.GetByID(ctx, estimateID)
	if err == nil && est != nil {
		est.VideoGCSPath = objectKey
		est.Status = "awaiting_customer"
		_ = repo.Save(ctx, est)
	}

	log.Printf("[Cloud Storage] ✅ Video uploaded successfully to GCS object: %s", objectKey)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "ok",
		"gcs_path": objectKey,
	})
}

// Called after browser finishes direct HTTP PUT to Google Cloud Storage
func handleVideoUploadComplete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	estimateID := r.URL.Query().Get("estimate_id")
	gcsPath := r.URL.Query().Get("gcs_path")

	ctx := r.Context()
	est, err := repo.GetByID(ctx, estimateID)
	if err != nil {
		http.Error(w, "Estimate not found", http.StatusNotFound)
		return
	}

	est.VideoGCSPath = gcsPath
	est.Status = "awaiting_customer"

	if err := repo.Save(ctx, est); err != nil {
		http.Error(w, "Failed to update Firestore", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// Customer review portal (what the customer opens from the text/email link)
func handleCustomerReview(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/review/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	ctx := r.Context()
	est, err := repo.GetByID(ctx, id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	playbackURL, _ := storageService.GeneratePlaybackSignedURL(ctx, est.VideoGCSPath)

	t, err := template.New("customer_review.html").Funcs(tmplFuncs).ParseFS(content, "templates/customer_review.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"Estimate":    est,
		"PlaybackURL": playbackURL,
		"Multiply": func(a, b float64) float64 {
			return a * b
		},
	}
	t.ExecuteTemplate(w, "customer_review.html", data)
}

// Customer approves the repair estimate via HTMX
func handleCustomerApprove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form", http.StatusBadRequest)
		return
	}

	estimateID := r.FormValue("estimate_id")
	signature := r.FormValue("signature")
	notes := r.FormValue("customer_notes")

	ctx := r.Context()
	est, err := repo.GetByID(ctx, estimateID)
	if err != nil {
		http.Error(w, "Estimate not found", http.StatusNotFound)
		return
	}

	est.Status = "approved"
	est.CustomerSignature = signature
	est.CustomerNotes = notes
	est.CustomerResponseDate = time.Now().Format("Jan 02, 2006 at 3:04 PM")

	if err := repo.Save(ctx, est); err != nil {
		http.Error(w, "Failed to update Firestore", http.StatusInternalServerError)
		return
	}

	// Render HTMX approval confirmation partial
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintf(w, `
		<div style="text-align: center; padding: 20px;">
			<div style="font-size: 2.5rem; margin-bottom: 8px;">🎉</div>
			<h3 style="font-size: 1.25rem; font-weight: 700; color: #34d399; margin-bottom: 6px;">
				Thank You, %s!
			</h3>
			<p style="font-size: 0.9rem; color: #e2e8f0; margin-bottom: 8px;">
				Your repair authorization for $%.2f has been received.
			</p>
			<div style="font-size: 0.8rem; color: #94a3b8;">
				Digitally signed on %s &middot; Shop has been dispatched to begin work.
			</div>
		</div>
	`, template.HTMLEscapeString(signature), est.GrandTotal(), est.CustomerResponseDate)
}

// handleVideoStream streams videos directly from private Cloud Storage with HTTP 206 Partial Content (Range) support for smooth seeking
func handleVideoStream(w http.ResponseWriter, r *http.Request) {
	objectKey := r.URL.Query().Get("path")
	if objectKey == "" {
		http.Error(w, "Missing path parameter", http.StatusBadRequest)
		return
	}

	if gcsClient == nil {
		http.Error(w, "Storage client not initialized", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	obj := gcsClient.Bucket(bucketName).Object(objectKey)

	attrs, err := obj.Attrs(ctx)
	if err != nil {
		log.Printf("[Video Stream] ⚠️ Object not found '%s' in bucket '%s': %v", objectKey, bucketName, err)
		http.Error(w, "Video not found", http.StatusNotFound)
		return
	}

	totalSize := attrs.Size
	contentType := attrs.ContentType
	if contentType == "" {
		contentType = "video/mp4"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")

	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		w.Header().Set("Content-Length", strconv.FormatInt(totalSize, 10))
		reader, err := obj.NewReader(ctx)
		if err != nil {
			http.Error(w, "Failed to read video", http.StatusInternalServerError)
			return
		}
		defer reader.Close()
		io.Copy(w, reader)
		return
	}

	// Parse Range header: bytes=start-end
	var start, end int64
	end = totalSize - 1
	rangeParts := strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.Split(rangeParts, "-")
	if len(parts) >= 1 && parts[0] != "" {
		start, _ = strconv.ParseInt(parts[0], 10, 64)
	}
	if len(parts) >= 2 && parts[1] != "" {
		end, _ = strconv.ParseInt(parts[1], 10, 64)
	}

	if start >= totalSize || end >= totalSize || start > end {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", totalSize))
		http.Error(w, "Requested range not satisfiable", http.StatusRequestedRangeNotSatisfiable)
		return
	}

	length := end - start + 1
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, totalSize))
	w.Header().Set("Content-Length", strconv.FormatInt(length, 10))
	w.WriteHeader(http.StatusPartialContent)

	reader, err := obj.NewRangeReader(ctx, start, length)
	if err != nil {
		log.Printf("[Video Stream] ⚠️ RangeReader error for '%s': %v", objectKey, err)
		return
	}
	defer reader.Close()
	io.Copy(w, reader)
}

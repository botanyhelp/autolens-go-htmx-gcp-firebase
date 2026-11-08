package main

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

func main() {
	ctx := context.Background()
	// Auto-detect project ID from standard GCP environment variables
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("DEVSHELL_PROJECT_ID")
	}

	bucketName = os.Getenv("GCS_VIDEO_BUCKET")
	if bucketName == "" && projectID != "" {
		bucketName = fmt.Sprintf("autolens-records-%s", projectID)
	} else if bucketName == "" {
		bucketName = "autolens-video-records"
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
	var gcsClient *gcs.Client
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

	// Video Signed URL API routes (Direct-to-GCS upload)
	mux.HandleFunc("/api/estimates/video-upload-url", handleGetUploadSignedURL)
	mux.HandleFunc("/api/estimates/video-complete", handleVideoUploadComplete)

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

// Direct-to-GCS: Returns a 15-minute write-only V4 Signed PUT URL
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

	url, path, err := storageService.GenerateUploadSignedURL(r.Context(), estimateID, contentType)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to sign URL: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"upload_url": url,
		"gcs_path":   path,
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

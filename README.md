# AutoLens — Car Repair Video Estimates (Go + HTMX + GCP)

A zero-churn, low-maintenance automotive repair estimate application built in **Go (standard library)** and **HTMX**, backed by **Google Cloud Storage (GCS)** for direct browser-to-cloud video walkarounds and **Google Cloud Firestore** for structured estimate records.

---

## 🚀 Quickstart: Run Locally in Go

You can run this application immediately on your local machine with no external dependencies required:

```bash
# Run the Go server directly (includes in-memory fallback & pre-seeded samples)
go run main.go
```

Then open your browser to:
* **Mechanic Bay Console:** [http://localhost:8080](http://localhost:8080)
* **Create New Work Order:** [http://localhost:8080/estimates/new](http://localhost:8080/estimates/new)
* **Customer Review Portal (Sample):** [http://localhost:8080/review/est-7821](http://localhost:8080/review/est-7821)

---

## 📂 Project Structure

```text
.
├── main.go               # Go HTTP server (net/http, go:embed, routes, API)
├── go.mod                # Official Go module configuration
├── pkg/
│   ├── db/               # Firestore repository with local memory fallback
│   └── storage/          # Google Cloud Storage V4 Signed URL generator
├── templates/            # Embedded HTML templates
│   ├── layout.html       # Master layout with HTMX
│   ├── dashboard.html    # Mechanic work orders queue
│   ├── new_estimate.html # Estimate & vehicle intake form
│   ├── estimate_detail.html # Direct-to-GCS video uploader
│   └── customer_review.html # Interactive customer approval portal
├── static/               # Embedded static assets (no CDN dependency!)
│   ├── htmx.min.js       # Standalone HTMX library
│   └── style.css         # Responsive mobile-friendly CSS
├── cors.json             # GCS Bucket CORS configuration for web uploads
├── Dockerfile            # Multi-stage build producing ~18MB scratch container
└── cloudbuild.yaml       # Google Cloud Build & Cloud Run deployment pipeline
```

---

## 🎥 How Direct-to-GCS Video Upload Works

Mechanics often record 50MB to 500MB high-definition walkaround videos in the repair bay. Passing large video streams through your application server can exhaust memory and trigger Cloud Run request timeouts.

AutoLens uses **V4 Signed URLs**:
1. When the mechanic selects or records a video, the browser asks the Go server: `POST /api/estimates/video-upload-url`
2. Go uses the official Cloud Storage SDK to create a **15-minute write-only PUT URL**.
3. The browser streams the video binary **directly to Google Cloud Storage** (`storage.googleapis.com`) with an HTML5 upload progress bar.
4. When complete, the browser notifies Go to commit the GCS object path to Firestore.

---

## ☁️ Connecting to Live Google Cloud (GCP)

To connect to your live GCP project:

1. **Set your Google Cloud Project ID:**
   ```bash
   export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
   export GCS_VIDEO_BUCKET="your-video-bucket-name"
   ```

2. **Authenticate your local machine:**
   ```bash
   gcloud auth application-default login
   ```

3. **Configure your GCS Bucket for Browser Uploads (CORS):**
   ```bash
   gcloud storage buckets update gs://$GCS_VIDEO_BUCKET --cors-file=cors.json
   ```

4. **Run Go:**
   ```bash
   go run main.go
   ```

---

## 🚢 Deploy to Google Cloud Run in 1 Command

```bash
gcloud run deploy autolens \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCS_VIDEO_BUCKET=your-bucket-name
```

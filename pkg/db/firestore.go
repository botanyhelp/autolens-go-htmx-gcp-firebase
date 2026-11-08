package db

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

// PartItem represents an itemized part in an estimate
type PartItem struct {
	ID        string  `json:"id" firestore:"id"`
	Name      string  `json:"name" firestore:"name"`
	PartNo    string  `json:"part_no,omitempty" firestore:"part_no,omitempty"`
	Quantity  int     `json:"quantity" firestore:"quantity"`
	UnitCost  float64 `json:"unit_cost" firestore:"unit_cost"`
	Approved  bool    `json:"approved" firestore:"approved"`
	Required  bool    `json:"required" firestore:"required"`
}

// LaborItem represents a labor operation in an estimate
type LaborItem struct {
	ID          string  `json:"id" firestore:"id"`
	Description string  `json:"description" firestore:"description"`
	Hours       float64 `json:"hours" firestore:"hours"`
	HourlyRate  float64 `json:"hourly_rate" firestore:"hourly_rate"`
	Approved    bool    `json:"approved" firestore:"approved"`
	Required    bool    `json:"required" firestore:"required"`
}

// Estimate represents the full car repair estimate record
type Estimate struct {
	ID                   string      `json:"id" firestore:"id"`
	EstimateNumber       string      `json:"estimate_number" firestore:"estimate_number"`
	CustomerName         string      `json:"customer_name" firestore:"customer_name"`
	Email                string      `json:"email" firestore:"email"`
	Phone                string      `json:"phone" firestore:"phone"`
	VehicleYear          int         `json:"vehicle_year" firestore:"vehicle_year"`
	VehicleMake          string      `json:"vehicle_make" firestore:"vehicle_make"`
	VehicleModel         string      `json:"vehicle_model" firestore:"vehicle_model"`
	LicensePlate         string      `json:"license_plate" firestore:"license_plate"`
	Mileage              int         `json:"mileage" firestore:"mileage"`
	Urgency              string      `json:"urgency" firestore:"urgency"` // "safety_critical", "recommended_soon", "maintenance"
	MechanicName         string      `json:"mechanic_name" firestore:"mechanic_name"`
	ShopName             string      `json:"shop_name" firestore:"shop_name"`
	ShopPhone            string      `json:"shop_phone" firestore:"shop_phone"`
	Notes                string      `json:"notes" firestore:"notes"`
	Parts                []PartItem  `json:"parts" firestore:"parts"`
	Labor                []LaborItem `json:"labor" firestore:"labor"`
	TaxRatePercent       float64     `json:"tax_rate_percent" firestore:"tax_rate_percent"`
	VideoGCSPath         string      `json:"video_gcs_path,omitempty" firestore:"video_gcs_path,omitempty"`
	VideoPlaybackURL     string      `json:"video_playback_url,omitempty" firestore:"-"`
	Status               string      `json:"status" firestore:"status"` // "draft", "awaiting_customer", "approved", "declined"
	CustomerResponseDate string      `json:"customer_response_date,omitempty" firestore:"customer_response_date,omitempty"`
	CustomerSignature    string      `json:"customer_signature,omitempty" firestore:"customer_signature,omitempty"`
	CustomerNotes        string      `json:"customer_notes,omitempty" firestore:"customer_notes,omitempty"`
	CreatedAt            time.Time   `json:"created_at" firestore:"created_at"`
}

// TotalCalculations provides computed financial values
func (e *Estimate) PartsTotal() float64 {
	var total float64
	for _, p := range e.Parts {
		if p.Approved {
			total += float64(p.Quantity) * p.UnitCost
		}
	}
	return total
}

func (e *Estimate) LaborTotal() float64 {
	var total float64
	for _, l := range e.Labor {
		if l.Approved {
			total += l.Hours * l.HourlyRate
		}
	}
	return total
}

func (e *Estimate) TaxAmount() float64 {
	return (e.PartsTotal() * e.TaxRatePercent) / 100.0
}

func (e *Estimate) GrandTotal() float64 {
	return e.PartsTotal() + e.LaborTotal() + e.TaxAmount()
}

// Repository handles database persistence
type Repository struct {
	client *firestore.Client
	mu     sync.RWMutex
	memory map[string]*Estimate
}

// NewRepository creates a new database repository with in-memory fallback
func NewRepository(client *firestore.Client) *Repository {
	repo := &Repository{
		client: client,
		memory: make(map[string]*Estimate),
	}
	repo.seedInitialData()
	return repo
}

func (r *Repository) Save(ctx context.Context, est *Estimate) error {
	var firestoreErr error
	if r.client != nil {
		_, err := r.client.Collection("estimates").Doc(est.ID).Set(ctx, est)
		if err != nil {
			firestoreErr = err
			fmt.Printf("[Firestore] ⚠️  Write to Firestore collection 'estimates/%s' failed: %v\n", est.ID, err)
			fmt.Printf("[Firestore] 💡 Tip: If you haven't created the database yet, run: gcloud firestore databases create --location=nam5 --type=firestore-native\n")
		} else {
			fmt.Printf("[Firestore] ✅ Successfully saved estimate '%s' to GCP Firestore collection 'estimates'!\n", est.ID)
		}
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.memory[est.ID] = est

	// Return error only if both failed, otherwise local state succeeds
	_ = firestoreErr
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id string) (*Estimate, error) {
	if r.client != nil {
		doc, err := r.client.Collection("estimates").Doc(id).Get(ctx)
		if err == nil {
			var est Estimate
			if err := doc.DataTo(&est); err == nil {
				return &est, nil
			}
		}
	}

	r.mu.RLock()
	defer r.mu.RUnlock()
	est, exists := r.memory[id]
	if !exists {
		return nil, fmt.Errorf("estimate not found: %s", id)
	}
	return est, nil
}

func (r *Repository) ListAll(ctx context.Context) ([]*Estimate, error) {
	if r.client != nil {
		iter := r.client.Collection("estimates").OrderBy("created_at", firestore.Desc).Documents(ctx)
		var list []*Estimate
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				break
			}
			var est Estimate
			if err := doc.DataTo(&est); err == nil {
				list = append(list, &est)
			}
		}
		if len(list) > 0 {
			return list, nil
		}
	}

	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []*Estimate
	for _, est := range r.memory {
		list = append(list, est)
	}
	return list, nil
}

func (r *Repository) seedInitialData() {
	sample := &Estimate{
		ID:             "est-7821",
		EstimateNumber: "EST-2026-7821",
		CustomerName:   "Marcus Vance",
		Email:          "marcus.vance@example.com",
		Phone:          "(555) 389-2041",
		VehicleYear:    2021,
		VehicleMake:    "Toyota",
		VehicleModel:   "RAV4 XLE AWD",
		LicensePlate:   "7XYZ892",
		Mileage:        48920,
		Urgency:        "safety_critical",
		MechanicName:   "Dave Miller (Master Tech)",
		ShopName:       "Apex Motor Works & Diagnostics",
		ShopPhone:      "(555) 742-8800",
		Notes:          "Customer reported brake squeal and pedal pulse. Front pads worn to 1.8mm (legal minimum 3mm) and inner rotor has grooved heat scoring. Recommend front pad and rotor replacement.",
		TaxRatePercent: 7.75,
		Parts: []PartItem{
			{ID: "p1", Name: "Ceramic Front Brake Pads (Set of 4)", PartNo: "ACT1211A", Quantity: 1, UnitCost: 114.50, Approved: true, Required: true},
			{ID: "p2", Name: "Coated Front Brake Rotors (Pair)", PartNo: "120.44146", Quantity: 2, UnitCost: 89.00, Approved: true, Required: true},
			{ID: "p3", Name: "DOT 4 Synthetic Brake Fluid Flush", PartNo: "BF-DOT4", Quantity: 1, UnitCost: 24.50, Approved: true, Required: false},
		},
		Labor: []LaborItem{
			{ID: "l1", Description: "Remove & Replace Front Brake Pads and Rotors", Hours: 1.8, HourlyRate: 145.00, Approved: true, Required: true},
			{ID: "l2", Description: "Hydraulic Brake Line Bleed & System Flush", Hours: 0.8, HourlyRate: 145.00, Approved: true, Required: false},
		},
		VideoGCSPath: "estimates/est-7821/walkaround.mp4",
		Status:       "awaiting_customer",
		CreatedAt:    time.Now().Add(-2 * time.Hour),
	}
	r.memory[sample.ID] = sample
}

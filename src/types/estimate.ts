export type UrgencyLevel = 'safety_critical' | 'recommended_soon' | 'routine_maintenance';

export type EstimateStatus = 'draft' | 'awaiting_customer' | 'partially_approved' | 'approved' | 'declined';

export interface PartItem {
  id: string;
  name: string;
  partNumber?: string;
  quantity: number;
  unitCost: number;
  approved: boolean;
  required: boolean;
}

export interface LaborItem {
  id: string;
  description: string;
  hours: number;
  hourlyRate: number;
  approved: boolean;
  required: boolean;
}

export interface VideoChapter {
  id: string;
  timeSeconds: number;
  title: string;
  note?: string;
}

export interface VideoReview {
  url: string;
  fileName: string;
  durationSeconds?: number;
  fileSizeFormatted?: string;
  gcsObjectPath?: string;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'none';
  uploadProgress?: number;
  chapters: VideoChapter[];
  thumbnailUrl?: string;
}

export interface Vehicle {
  year: number;
  make: string;
  model: string;
  trim?: string;
  licensePlate?: string;
  vin?: string;
  mileage?: number;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  customerName: string;
  email: string;
  phone: string;
  vehicle: Vehicle;
  urgency: UrgencyLevel;
  mechanicName: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  notes: string;
  partsItems: PartItem[];
  laborItems: LaborItem[];
  taxRatePercent: number; // e.g. 7.5%
  video?: VideoReview;
  status: EstimateStatus;
  createdAt: string;
  customerResponseDate?: string;
  customerSignature?: string;
  customerNotes?: string;
}

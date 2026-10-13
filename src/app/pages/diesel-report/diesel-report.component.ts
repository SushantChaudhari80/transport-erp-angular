import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { parseVehicleOptions, VehicleOption } from '../../core/utils/vehicle-option';
import { Host } from '../../core/services/host';

interface DieselRecord {
  id: number | string;
  date?: string | null;
  orderName?: string | null;
  machineNumber?: string | null;
  petrolPump?: string | null;
  fuelRate?: number | string | null;
  diesel?: number | string | null;
}

interface DieselForm {
  vehicleId: string;
  fuelInLtr: number | null;
  petrolPump: string;
  rate: number | null;
}

const PETROL_PUMPS = [
  'Indian Oil Corporation (IOCL)',
  'Bharat Petroleum Corporation Limited (BPCL)',
  'Hindustan Petroleum Corporation Limited (HPCL)',
  'Reliance Petroleum',
  'Shell India',
  'Essar Oil (Now Nayara Energy)',
  'ONGC (Oil and Natural Gas Corporation)',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDieselRecord(value: unknown): value is DieselRecord {
  if (!isRecord(value) || (typeof value['id'] !== 'number' && typeof value['id'] !== 'string')) {
    return false;
  }

  return (
    (value['date'] === undefined || value['date'] === null || typeof value['date'] === 'string') &&
    (value['orderName'] === undefined ||
      value['orderName'] === null ||
      typeof value['orderName'] === 'string') &&
    (value['machineNumber'] === undefined ||
      value['machineNumber'] === null ||
      typeof value['machineNumber'] === 'string') &&
    (value['petrolPump'] === undefined ||
      value['petrolPump'] === null ||
      typeof value['petrolPump'] === 'string') &&
    (value['fuelRate'] === undefined ||
      value['fuelRate'] === null ||
      typeof value['fuelRate'] === 'number' ||
      typeof value['fuelRate'] === 'string') &&
    (value['diesel'] === undefined ||
      value['diesel'] === null ||
      typeof value['diesel'] === 'number' ||
      typeof value['diesel'] === 'string')
  );
}

@Component({
  selector: 'app-diesel-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diesel-report.component.html',
  styleUrl: './diesel-report.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DieselReportComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  readonly petrolPumps = PETROL_PUMPS;
  vehicles: VehicleOption[] = [];
  records: DieselRecord[] = [];
  form: DieselForm = this.emptyForm();
  searchTerm = '';
  loadingRecords = false;
  loadingVehicles = false;
  saving = false;
  showAddModal = false;
  errorMessage = '';
  modalError = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadVehicles();
    this.loadRecords();
  }

  get filteredRecords(): DieselRecord[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.records;
    }
    return this.records.filter((record) =>
      [
        record.id,
        record.date,
        record.orderName,
        record.machineNumber,
        record.petrolPump,
        record.fuelRate,
        record.diesel,
      ].some((value) => String(value ?? '').toLowerCase().includes(query)),
    );
  }

  get totalVehicles(): number {
    return new Set(
      this.records.map((record) => record.machineNumber?.trim()).filter(Boolean),
    ).size;
  }

  get totalFuel(): number {
    return this.records.reduce((sum, record) => sum + this.numberValue(record.diesel), 0);
  }

  get totalAmount(): number {
    return this.records.reduce(
      (sum, record) => sum + this.numberValue(record.diesel) * this.numberValue(record.fuelRate),
      0,
    );
  }

  loadVehicles(): void {
    this.loadingVehicles = true;
    this.http.get<unknown>(`${this.apiUrl}/api/vehicles/getAll`).subscribe({
      next: (response) => {
        const vehicles = parseVehicleOptions(response);
        if (vehicles === null) {
          console.error('Unexpected response from vehicles API:', response);
          this.errorMessage = 'The vehicles service returned an unexpected response.';
          this.vehicles = [];
        } else {
          this.vehicles = vehicles;
        }
        this.loadingVehicles = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load vehicles for diesel entry:', error);
        this.loadingVehicles = false;
        this.errorMessage = 'Unable to load vehicles. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  loadRecords(): void {
    this.loadingRecords = true;
    this.http.get<unknown>(`${this.apiUrl}/vehicle/getDisel`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isDieselRecord)) {
          console.error('Unexpected response from diesel records API:', response);
          this.errorMessage = 'The diesel report service returned an unexpected response.';
          this.records = [];
        } else {
          this.records = [...response].sort((left, right) => this.compareIds(right.id, left.id));
        }
        this.loadingRecords = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load diesel report:', error);
        this.loadingRecords = false;
        this.errorMessage = 'Unable to load diesel records. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  openAddModal(): void {
    this.form = this.emptyForm();
    this.modalError = '';
    this.showAddModal = true;
  }

  closeAddModal(): void {
    if (this.saving) {
      return;
    }
    this.showAddModal = false;
    this.modalError = '';
  }

  submitDiesel(): void {
    if (this.saving) {
      return;
    }
    const vehicle = this.vehicles.find((entry) => String(entry.id) === this.form.vehicleId);
    const fuelInLtr = this.form.fuelInLtr;
    const rate = this.form.rate;
    if (!vehicle) {
      this.modalError = 'Select a vehicle.';
      return;
    }
    if (fuelInLtr === null || !Number.isFinite(fuelInLtr) || fuelInLtr <= 0) {
      this.modalError = 'Enter fuel in litres greater than zero.';
      return;
    }
    if (rate === null || !Number.isFinite(rate) || rate <= 0) {
      this.modalError = 'Enter a fuel rate greater than zero.';
      return;
    }
    if (!this.form.petrolPump) {
      this.modalError = 'Select a petrol pump.';
      return;
    }

    const vehicleNumber = vehicle.machine_number || vehicle.machineNumber || '';
    this.saving = true;
    this.modalError = '';
    this.successMessage = '';
    this.http.post(`${this.apiUrl}/api/diesel/addDiesel`, {
      vehicleNumber,
      fuelInLtr,
      petrolPump: this.form.petrolPump,
      rate,
    }, { responseType: 'text' }).subscribe({
      next: (response) => {
        console.log('Add diesel API response:', response);
        this.saving = false;
        this.showAddModal = false;
        this.form = this.emptyForm();
        this.successMessage = response.trim() || 'Diesel record added successfully.';
        this.loadRecords();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to add diesel record:', error);
        this.saving = false;
        this.modalError = 'Failed to add diesel record. Please try again.';
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  formatNumber(value: number | string | null | undefined, maximumFractionDigits = 2): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(this.numberValue(value));
  }

  recordAmount(record: DieselRecord): number {
    return this.numberValue(record.diesel) * this.numberValue(record.fuelRate);
  }

  vehicleNumber(vehicle: VehicleOption): string {
    return vehicle.machine_number || vehicle.machineNumber || 'Vehicle';
  }

  private compareIds(left: number | string, right: number | string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
    return String(left).localeCompare(String(right));
  }

  private numberValue(value: number | string | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private emptyForm(): DieselForm {
    return { vehicleId: '', fuelInLtr: null, petrolPump: '', rate: null };
  }
}

import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { parseVehicleOptions, VehicleOption } from '../../core/utils/vehicle-option';
import { Host } from '../../core/services/host';

interface VoucherDriver {
  id: number | string;
  driverName: string;
}

interface Voucher {
  id: number | string;
  machineNumber?: string;
  driverName?: string;
  amount?: number | string;
  createDate?: string;
  comment?: string;
}

interface VoucherForm {
  vehicleId: string;
  driverId: string;
  amount: number | null;
  createDate: string;
  comment: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasId(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    (typeof value['id'] === 'number' || typeof value['id'] === 'string')
  );
}

function isDriver(value: unknown): value is VoucherDriver {
  return hasId(value) && typeof value['driverName'] === 'string';
}

function isVoucher(value: unknown): value is Voucher {
  return (
    hasId(value) &&
    (value['machineNumber'] === undefined || typeof value['machineNumber'] === 'string') &&
    (value['driverName'] === undefined || typeof value['driverName'] === 'string') &&
    (value['amount'] === undefined ||
      typeof value['amount'] === 'number' ||
      typeof value['amount'] === 'string') &&
    (value['createDate'] === undefined || typeof value['createDate'] === 'string') &&
    (value['comment'] === undefined || typeof value['comment'] === 'string')
  );
}

@Component({
  selector: 'app-vouchers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vouchers.component.html',
  styleUrl: './vouchers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VouchersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  vouchers: Voucher[] = [];
  vehicles: VehicleOption[] = [];
  drivers: VoucherDriver[] = [];
  form: VoucherForm = this.emptyForm();
  searchTerm = '';
  loadingVouchers = false;
  loadingVehicles = false;
  loadingDrivers = false;
  savingVoucher = false;
  deletingVoucherId: number | string | null = null;
  showAddModal = false;
  errorMessage = '';
  modalError = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadVouchers();
    this.loadVehicles();
    this.loadDrivers();
  }

  get filteredVouchers(): Voucher[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.vouchers;
    }
    return this.vouchers.filter((voucher) =>
      [
        voucher.id,
        voucher.machineNumber,
        voucher.driverName,
        voucher.amount,
        voucher.createDate,
        voucher.comment,
      ].some((value) => String(value ?? '').toLowerCase().includes(query)),
    );
  }

  loadVouchers(): void {
    this.loadingVouchers = true;
    this.http.get<unknown>(`${this.apiUrl}/api/voucher/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isVoucher)) {
          console.error('Unexpected response from vouchers API:', response);
          this.errorMessage = 'The voucher service returned an unexpected response.';
          this.vouchers = [];
        } else {
          this.vouchers = [...response].sort((left, right) => this.compareIds(right.id, left.id));
        }
        this.loadingVouchers = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load vouchers:', error);
        this.loadingVouchers = false;
        this.errorMessage = 'Unable to load vouchers. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  loadVehicles(): void {
    this.loadingVehicles = true;
    this.http.get<unknown>(`${this.apiUrl}/api/vehicles/getAll`).subscribe({
      next: (response) => {
        const vehicles = parseVehicleOptions(response);
        if (vehicles === null) {
          console.error('Unexpected response from voucher vehicle API:', response);
          this.errorMessage = 'The vehicle service returned an unexpected response.';
          this.vehicles = [];
        } else {
          this.vehicles = vehicles;
        }
        this.loadingVehicles = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load vehicles for voucher entry:', error);
        this.loadingVehicles = false;
        this.errorMessage = 'Unable to load vehicles for vouchers.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  loadDrivers(): void {
    this.loadingDrivers = true;
    this.http.get<unknown>(`${this.apiUrl}/api/driver/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isDriver)) {
          console.error('Unexpected response from voucher driver API:', response);
          this.errorMessage = 'The driver service returned an unexpected response.';
          this.drivers = [];
        } else {
          this.drivers = response;
        }
        this.loadingDrivers = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load drivers for voucher entry:', error);
        this.loadingDrivers = false;
        this.errorMessage = 'Unable to load drivers for vouchers.';
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
    if (this.savingVoucher) {
      return;
    }
    this.showAddModal = false;
    this.modalError = '';
  }

  submitVoucher(): void {
    if (this.savingVoucher) {
      return;
    }

    const vehicle = this.vehicles.find((item) => String(item.id) === this.form.vehicleId);
    const driver = this.drivers.find((item) => String(item.id) === this.form.driverId);
    const amount = this.form.amount;
    const createDate = this.form.createDate;
    const comment = this.form.comment.trim();

    if (!vehicle || !driver) {
      this.modalError = 'Select a vehicle and driver.';
      return;
    }
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      this.modalError = 'Enter an amount greater than zero.';
      return;
    }
    if (!createDate || !comment) {
      this.modalError = 'Enter a date and comment.';
      return;
    }

    this.savingVoucher = true;
    this.modalError = '';
    this.successMessage = '';
    this.http.post(
      `${this.apiUrl}/api/voucher/add`,
      {
        machineNumber: vehicle.machine_number || vehicle.machineNumber || '',
        driverName: driver.driverName,
        amount,
        createDate,
        comment,
      },
      { responseType: 'text' },
    ).subscribe({
      next: (response) => {
        console.log('Add voucher API response:', response);
        this.savingVoucher = false;
        this.showAddModal = false;
        this.form = this.emptyForm();
        this.successMessage = response.trim() || 'Voucher added successfully.';
        this.loadVouchers();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to add voucher:', error);
        this.savingVoucher = false;
        this.modalError = 'Error adding voucher. Please try again.';
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  deleteVoucher(voucher: Voucher): void {
    if (this.deletingVoucherId !== null) {
      return;
    }
    if (!window.confirm(`Delete voucher #${voucher.id}?`)) {
      return;
    }

    this.deletingVoucherId = voucher.id;
    this.errorMessage = '';
    this.http.get(`${this.apiUrl}/api/voucher/delete/`, {
      params: new HttpParams().set('id', voucher.id),
      responseType: 'text',
    }).subscribe({
      next: (response) => {
        console.log('Delete voucher API response:', response);
        this.deletingVoucherId = null;
        this.successMessage = response.trim() || 'Voucher deleted successfully.';
        this.loadVouchers();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to delete voucher:', error);
        this.deletingVoucherId = null;
        this.errorMessage = 'Error deleting voucher. Please try again.';
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  formatAmount(value: number | string | undefined): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return '—';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  }

  vehicleNumber(vehicle: VehicleOption): string {
    return vehicle.machine_number || vehicle.machineNumber || 'Vehicle';
  }

  private compareIds(left: number | string, right: number | string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : String(left).localeCompare(String(right));
  }

  private emptyForm(): VoucherForm {
    return {
      vehicleId: '',
      driverId: '',
      amount: null,
      createDate: '',
      comment: '',
    };
  }
}

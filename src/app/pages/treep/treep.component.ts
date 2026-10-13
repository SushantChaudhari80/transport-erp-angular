import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import {
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import { finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Host } from '../../core/services/host';
import { parseVehicleOptions, VehicleOption } from '../../core/utils/vehicle-option';

type Vehicle = VehicleOption;

interface Customer {
  id: number | string;
  customer_name?: string | null;
}


interface CustomerDetails {
  name?: string;
  mobile?: string;
  address?: string;
  bussinessName?: string;
  picture?: string;
}


interface TreepPayload {
  selectedVehicle: string;
  customerName: string;
  soilBrass: number;
  soilRate: number;
  item: string;
  isBilled: boolean;
  submittedBy: string;
}


@Component({
  selector: 'app-treep',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl: './treep.component.html',
  styleUrl: './treep.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreepComponent implements OnInit {

  private readonly http = inject(HttpClient);

  private readonly changeDetector = inject(ChangeDetectorRef);

  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');


  // ============================================================
  // State
  // ============================================================

  loading = false;
  loadingVehicles = false;
  loadingCustomers = false;
  loadingCustomerDetails = false;

  errorMessage = '';

  successMessage = '';


  // ============================================================
  // Master Data
  // ============================================================

  vehicles: Vehicle[] = [];

  customers: Customer[] = [];

  customerDetails: CustomerDetails | null = null;


  // ============================================================
  // Form
  // ============================================================

  selectedCustomerId: number | null = null;

  selectedVehicleId: number | null = null;

  selectedMaterial = '';

  soilBrass: number | null = null;

  soilRate: number | null = null;


  // ============================================================
  // Receipt
  // ============================================================

  readonly billNo = '2102';

  receiptDate = '';


  readonly materials = [
    'Soil',
    'Bricks',
    'Crush Sand',
    'Sand',
  ];


  ngOnInit(): void {

    this.receiptDate =
      this.getFormattedDate();

    this.loadVehicles();

    this.loadCustomers();

    this.loadCustomerDetails();

  }


  // ============================================================
  // API: Vehicles
  // ============================================================

  loadVehicles(): void {
    this.loadingVehicles = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/api/vehicles/getAll`).pipe(
      finalize(() => {
        this.loadingVehicles = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        const vehicles = parseVehicleOptions(response);
        if (vehicles === null) {
          console.error('Unexpected vehicle list response:', response);
          this.vehicles = [];
          this.errorMessage = 'The vehicle service returned an unexpected response.';
        } else {
          const uniqueVehicles = new Map<string, Vehicle>();
          for (const vehicle of vehicles) {
            const machineNumber = this.vehicleNumber(vehicle);
            const key = machineNumber.toLocaleLowerCase();
            if (key && !uniqueVehicles.has(key)) {
              uniqueVehicles.set(key, vehicle);
            }
          }
          this.vehicles = [...uniqueVehicles.values()];
          if (
            this.selectedVehicleId !== null &&
            !this.vehicles.some((vehicle) => String(vehicle.id) === String(this.selectedVehicleId))
          ) {
            this.selectedVehicleId = null;
          }
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load vehicles:', error);
        this.errorMessage = 'Unable to load vehicles. Please try again.';
        this.changeDetector.markForCheck();
      },
    });
  }


  // ============================================================
  // API: Customers
  // ============================================================

  loadCustomers(): void {
    this.loadingCustomers = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/api/order/getAll`).pipe(
      finalize(() => {
        this.loadingCustomers = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every((customer) => this.isCustomer(customer))) {
          console.error('Unexpected customer list response:', response);
          this.customers = [];
          this.errorMessage = 'The order service returned an unexpected customer response.';
        } else {
          const uniqueCustomers = new Map<string, Customer>();
          for (const customer of response) {
            const name = customer.customer_name?.trim() ?? '';
            const key = name.toLocaleLowerCase();
            if (key && !uniqueCustomers.has(key)) {
              uniqueCustomers.set(key, { ...customer, customer_name: name });
            }
          }
          this.customers = [...uniqueCustomers.values()].sort((left, right) =>
            (left.customer_name ?? '').localeCompare(right.customer_name ?? ''),
          );
          if (
            this.selectedCustomerId !== null &&
            !this.customers.some((customer) => String(customer.id) === String(this.selectedCustomerId))
          ) {
            this.selectedCustomerId = null;
          }
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load customer list:', error);
        this.errorMessage = 'Unable to load customers. Please try again.';
        this.changeDetector.markForCheck();
      },
    });
  }


  // ============================================================
  // API: Customer / Owner Details
  // ============================================================

  loadCustomerDetails(): void {
    this.loadingCustomerDetails = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/api/customers/get`).pipe(
      finalize(() => {
        this.loadingCustomerDetails = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        if (!this.isCustomerDetails(response)) {
          console.error('Unexpected receipt owner details response:', response);
          this.customerDetails = null;
          this.errorMessage = 'The business profile service returned an unexpected response.';
        } else {
          this.customerDetails = response;
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load receipt owner details:', error);
        this.errorMessage = 'Unable to load business profile details.';
        this.changeDetector.markForCheck();
      },
    });
  }


  // ============================================================
  // Selected Customer
  // ============================================================

  get selectedCustomer(): Customer | undefined {

    if (this.selectedCustomerId === null) {
      return undefined;
    }

    return this.customers.find(
      (customer) => String(customer.id) === String(this.selectedCustomerId),
    );
  }


  get selectedCustomerName(): string {

    return (
      this.selectedCustomer
        ?.customer_name
        ?.trim() || '-'
    );
  }

  get businessLogoUrl(): string | null {
    const picture = this.customerDetails?.picture?.trim();
    if (!picture) {
      return null;
    }

    return /^data:image\//i.test(picture)
      ? picture
      : `data:image/png;base64,${picture}`;
  }


  // ============================================================
  // Selected Vehicle
  // ============================================================

  get selectedVehicle(): Vehicle | undefined {

    if (this.selectedVehicleId === null) {
      return undefined;
    }

    return this.vehicles.find(
      (vehicle) => String(vehicle.id) === String(this.selectedVehicleId),
    );
  }


  get selectedVehicleNumber(): string {

    if (!this.selectedVehicle) {
      return '-';
    }

    return (
      this.selectedVehicle.machine_number ||
      this.selectedVehicle.machineNumber ||
      '-'
    );
  }


  // ============================================================
  // Form Validation
  // ============================================================

  private validateForm(): boolean {

    this.errorMessage = '';

    if (    !this.selectedCustomer) {

      this.errorMessage =
        'Please select a customer.';

      return false;
    }

    if (    !this.selectedVehicle) {

      this.errorMessage =
        'Please select a vehicle.';

      return false;
    }

    if (!this.selectedMaterial) {

      this.errorMessage =
        'Please select material.';

      return false;
    }

    if (this.soilBrass === null || !Number.isFinite(this.soilBrass) || this.soilBrass <= 0) {

      this.errorMessage =
        'Please enter a valid quantity.';

      return false;
    }

    if (this.soilRate === null || !Number.isFinite(this.soilRate) || this.soilRate < 0) {

      this.errorMessage =
        'Please enter a valid rate.';

      return false;
    }

    return true;
  }


  // ============================================================
  // Payload
  // ============================================================

  private buildPayload(): TreepPayload {

    return {

      selectedVehicle:
        this.selectedVehicleNumber,

      customerName:
        this.selectedCustomerName,

      soilBrass:
        Number(this.soilBrass),

      soilRate:
        Number(this.soilRate),

      item:
        this.selectedMaterial,

      submittedBy:
        "Admin",

      isBilled: false,
    };
  }

  get totalAmount(): number {
    return (this.soilBrass ?? 0) * (this.soilRate ?? 0);
  }

  get masterDataLoading(): boolean {
    return this.loadingCustomers || this.loadingVehicles;
  }

  get canSubmit(): boolean {
    return !this.loading &&
      !this.masterDataLoading &&
      !!this.selectedCustomer &&
      !!this.selectedVehicle &&
      !!this.selectedMaterial &&
      this.soilBrass !== null &&
      Number.isFinite(this.soilBrass) &&
      this.soilBrass > 0 &&
      this.soilRate !== null &&
      Number.isFinite(this.soilRate) &&
      this.soilRate >= 0;
  }

  retryCustomerLoad(): void {
    this.loadCustomers();
  }

  retryVehicleLoad(): void {
    this.loadVehicles();
  }

  private vehicleNumber(vehicle: Vehicle): string {
    return vehicle.machine_number?.trim() || vehicle.machineNumber?.trim() || '';
  }

  private isCustomer(value: unknown): value is Customer {
    if (!this.isRecord(value)) {
      return false;
    }
    return (
      (typeof value['id'] === 'number' || typeof value['id'] === 'string') &&
      (value['customer_name'] === undefined ||
        value['customer_name'] === null ||
        typeof value['customer_name'] === 'string')
    );
  }

  private isCustomerDetails(value: unknown): value is CustomerDetails {
    if (!this.isRecord(value)) {
      return false;
    }
    return ['name', 'mobile', 'address', 'bussinessName', 'picture'].every(
      (key) => value[key] === undefined || value[key] === null || typeof value[key] === 'string',
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }


  // ============================================================
  // Save Treep
  // ============================================================

  saveTreep(): void {

    if (this.loading) {
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.loading = true;

    this.errorMessage = '';

    this.successMessage = '';

    const payload =
      this.buildPayload();

    this.http
      .post(
        `${this.apiUrl}/api/treep/add`,
        payload,
        {
          responseType: 'text',
        }
      )
      .subscribe({

        next: (response) => {

          console.log(
            'Treep saved:',
            response
          );

          this.loading = false;

          this.successMessage =
            response ||
            'Treep saved successfully.';

          this.changeDetector.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error saving treep:',
            error
          );

          this.loading = false;

          this.errorMessage =
            error.error ||
            'Unable to save treep. Please try again.';

          this.changeDetector.markForCheck();
        },
      });
  }


  // ============================================================
  // Download / Print
  // ============================================================

  downloadPdf(): void {

    if (this.loading) {
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    /*
     * Preserve the existing JSP behavior:
     *
     * 1. Save the treep
     * 2. Open browser print dialog
     * 3. User can choose "Save as PDF"
     */

    this.loading = true;

    this.errorMessage = '';

    this.successMessage = '';

    const payload =
      this.buildPayload();

    this.http
      .post(
        `${this.apiUrl}/api/treep/add`,
        payload,
        {
          responseType: 'text',
        }
      )
      .subscribe({

        next: (response) => {

          console.log(
            'Treep saved before print:',
            response
          );

          this.loading = false;

          this.changeDetector.markForCheck();

          setTimeout(() => {

            window.print();

          }, 100);

        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error saving treep:',
            error
          );

          this.loading = false;

          this.errorMessage =
            error.error ||
            'Unable to save treep. PDF was not generated.';

          this.changeDetector.markForCheck();
        },
      });
  }


  // ============================================================
  // Date
  // ============================================================

  private getFormattedDate(): string {

    const today = new Date();

    const dd =
      String(today.getDate())
        .padStart(2, '0');

    const mm =
      String(today.getMonth() + 1)
        .padStart(2, '0');

    const yyyy =
      today.getFullYear();

    return `${dd}/${mm}/${yyyy}`;
  }


  // ============================================================
  // Reset
  // ============================================================

  resetForm(): void {

    this.selectedCustomerId = null;

    this.selectedVehicleId = null;

    this.selectedMaterial = '';

    this.soilBrass = null;

    this.soilRate = null;

    this.errorMessage = '';

    this.successMessage = '';
  }
}
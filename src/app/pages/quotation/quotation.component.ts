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

interface Customer {
  id?: number | string;
  customer_name: string;
  address?: string | null;
}


interface CustomerDetails {
  name?: string;
  mobile?: string;
  address?: string;
  bussinessName?: string;
  gstNo?: string;
  picture?: string;
}

type Vehicle = VehicleOption;


interface MaterialRow {
  name: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}


@Component({
  selector: 'app-quotation',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl: './quotation.component.html',
  styleUrl: './quotation.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationComponent implements OnInit {

  private readonly http = inject(HttpClient);

  private readonly changeDetector = inject(ChangeDetectorRef);

  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');


  // ============================================================
  // Loading
  // ============================================================

  loading = false;
  loadingVehicles = false;
  loadingCustomers = false;
  loadingCustomerDetails = false;

  errorMessage = '';


  // ============================================================
  // Master Data
  // ============================================================

  vehicles: Vehicle[] = [];

  customers: Customer[] = [];

  customerDetails: CustomerDetails | null = null;


  // ============================================================
  // Form
  // ============================================================

  selectedCustomer = '';

  selectedCustomerAddress = '';

  selectedMaterial = 'Other';

  quantity = 0;

  selectedUnit = 'Brass';

  rate = 0;

  selectedVehicle = '';


  // ============================================================
  // Quotation
  // ============================================================

  billNo = '2102';

  quotationDate = '';

  totalAmount = 0;


  readonly materials = [
    'Other',
    'Sand',
    'Bricks',
    'Crush Sand',
    'Cement',
    'Steel',
    'Soil',
  ];

  readonly units = ['Brass', 'Treep', 'KG', 'N', 'Bags'];


  materialRows: MaterialRow[] = [
    {
      name: 'Sand',
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    },
    {
      name: 'Bricks',
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    },
    {
      name: 'Crush Sand',
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    },
    {
      name: 'Cement',
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    },
    {
      name: 'Steel',
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    },
    {
      name: 'Soil',
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    },
    {
      name: 'Others',
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    },
  ];


  ngOnInit(): void {

    this.quotationDate = this.getFormattedDate();

    this.loadVehicles();

    this.loadCustomers();

    this.loadCustomerDetails();

  }


  // ============================================================
  // Load Vehicles
  // ============================================================

  loadVehicles(): void {
    this.loadingVehicles = true;
    this.http.get<unknown>(`${this.apiUrl}/api/vehicles/getAll`).pipe(
      finalize(() => {
        this.loadingVehicles = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        const vehicles = parseVehicleOptions(response);
        if (vehicles === null) {
          console.error('Unexpected quotation vehicles response:', response);
          this.vehicles = [];
          this.errorMessage = 'The vehicle service returned an unexpected response.';
        } else {
          const uniqueVehicles = new Map<string, Vehicle>();
          for (const vehicle of vehicles) {
            const number = this.getVehicleNumber(vehicle);
            const key = number.toLocaleLowerCase();
            if (key && !uniqueVehicles.has(key)) {
              uniqueVehicles.set(key, vehicle);
            }
          }
          this.vehicles = [...uniqueVehicles.values()];
          if (!this.vehicles.some((vehicle) => String(vehicle.id) === this.selectedVehicle)) {
            this.selectedVehicle = '';
          }
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load vehicles for quotation:', error);
        this.errorMessage = 'Unable to load vehicles. Please try again.';
        this.changeDetector.markForCheck();
      },
    });
  }


  // ============================================================
  // Load Customers
  // ============================================================

  loadCustomers(): void {
    this.loadingCustomers = true;
    this.http.get<unknown>(`${this.apiUrl}/api/order/getAll`).pipe(
      finalize(() => {
        this.loadingCustomers = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        if (!Array.isArray(response)) {
          console.error('Unexpected quotation customers response:', response);
          this.customers = [];
          this.errorMessage = 'The order service returned an unexpected customer response.';
        } else {
          const customers = new Map<string, Customer>();
          for (const item of response) {
            if (!this.isCustomer(item)) {
              console.warn('Skipping invalid customer record in quotation response:', item);
              continue;
            }
            const row = item;
            const name = row.customer_name.trim();
            const key = name.toLocaleLowerCase();
            if (key && !customers.has(key)) {
              customers.set(key, { ...row, customer_name: name, address: row.address?.trim() ?? '' });
            }
          }
          this.customers = [...customers.values()].sort((left, right) =>
            left.customer_name.localeCompare(right.customer_name),
          );
          if (!this.customers.some((customer) => customer.customer_name === this.selectedCustomer)) {
            this.selectedCustomer = '';
            this.selectedCustomerAddress = '';
          }
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load customers for quotation:', error);
        this.errorMessage = 'Unable to load customers. Please try again.';
        this.changeDetector.markForCheck();
      },
    });
  }


  // ============================================================
  // Load Company / Customer Details
  // ============================================================

  loadCustomerDetails(): void {
    this.loadingCustomerDetails = true;
    this.http.get<unknown>(`${this.apiUrl}/api/customers/get`).pipe(
      finalize(() => {
        this.loadingCustomerDetails = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        if (!this.isCustomerDetails(response)) {
          console.error('Unexpected quotation business details response:', response);
          this.customerDetails = null;
          this.errorMessage = 'The business profile service returned an unexpected response.';
        } else {
          this.customerDetails = response;
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load quotation business details:', error);
        this.errorMessage = 'Unable to load business profile details.';
        this.changeDetector.markForCheck();
      },
    });
  }


  // ============================================================
  // Customer Selection
  // ============================================================

  onCustomerChange(): void {

    const customer = this.customers.find(
      (item) => item.customer_name === this.selectedCustomer,
    );

    this.selectedCustomerAddress =
      customer?.address ?? '';
    this.changeDetector.markForCheck();
  }


  get selectedCustomerName(): string {

    return this.selectedCustomer || '-';
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
  // Material
  // ============================================================

  onMaterialChange(): void {
    const rowName = this.selectedMaterial === 'Other'
      ? 'Others'
      : this.selectedMaterial;
    const row = this.materialRows.find((item) => item.name === rowName);
    this.quantity = row?.qty ?? 0;
    this.selectedUnit = row?.unit ?? 'Brass';
    this.rate = row?.rate ?? 0;
    this.changeDetector.markForCheck();
  }

  onUnitChange(): void {
    this.updateSelectedMaterial();
  }


  onQuantityOrRateChange(): void {

    this.updateSelectedMaterial();

  }


  private updateSelectedMaterial(): void {

    const rowName =
      this.selectedMaterial === 'Other'
        ? 'Others'
        : this.selectedMaterial;

    const row = this.materialRows.find(
      item => item.name === rowName
    );

    if (!row) {
      return;
    }

    row.qty = this.toNumber(this.quantity);

    row.unit = this.selectedUnit;

    row.rate = this.toNumber(this.rate);

    row.amount =
      row.qty * row.rate;

    this.recalculateTotal();

  }


  // ============================================================
  // Calculate Total
  // ============================================================

  calculateTotal(): void {

    this.updateSelectedMaterial();

    this.recalculateTotal();

  }


  private recalculateTotal(): void {

    this.totalAmount =
      this.materialRows.reduce(
        (total, row) =>
          total + row.amount,
        0
      );

  }


  // ============================================================
  // Helpers
  // ============================================================

  private toNumber(
    value: number | string | null | undefined
  ): number {

    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const numberValue = Number(value);

    return Number.isFinite(numberValue)
      ? numberValue
      : 0;
  }


  getFormattedDate(): string {

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


  getVehicleNumber(
    vehicle: Vehicle
  ): string {

    return (
      vehicle.machine_number ||
      vehicle.machineNumber ||
      ''
    );
  }


  formatAmount(
    amount: number
  ): string {

    return this.toNumber(amount).toFixed(2);
  }

  get currentLineAmount(): number {
    const rowName = this.selectedMaterial === 'Other'
      ? 'Others'
      : this.selectedMaterial;
    return this.materialRows.find((row) => row.name === rowName)?.amount ?? 0;
  }

  get quotationLineCount(): number {
    return this.materialRows.filter((row) => row.qty > 0 || row.rate > 0).length;
  }


  // ============================================================
  // Print
  // ============================================================

  printQuotation(): void {
    document.body.classList.add('quotation-print-mode');
    try {
      window.print();
    } finally {
      document.body.classList.remove('quotation-print-mode');
    }
  }

  get masterDataLoading(): boolean {
    return this.loadingCustomers || this.loadingVehicles;
  }

  retryCustomerLoad(): void {
    this.loadCustomers();
  }

  retryVehicleLoad(): void {
    this.loadVehicles();
  }

  resetQuotation(): void {
    this.selectedCustomer = '';
    this.selectedCustomerAddress = '';
    this.selectedVehicle = '';
    this.selectedMaterial = 'Other';
    this.quantity = 0;
    this.selectedUnit = 'Brass';
    this.rate = 0;
    this.materialRows = this.materialRows.map((row) => ({
      ...row,
      qty: 0,
      unit: 'Brass',
      rate: 0,
      amount: 0,
    }));
    this.totalAmount = 0;
    this.errorMessage = '';
    this.changeDetector.markForCheck();
  }


  // ============================================================
  // Save
  // ============================================================

  saveQuotation(): void {

    /*
     * The original JSP has the /api/treep/add request commented
     * out. Therefore this method does not call an API yet.
     *
     * When you are ready to enable saving, use the payload below.
     */

    const payload = {

      selectedVehicle:
        this.getSelectedVehicleText(),

      customerName:
        this.selectedCustomerName,

      soilBrass:
        this.quantity,

      soilRate:
        this.rate,

      item:
        this.selectedMaterial,

      isBilled: false,

    };

    console.log(
      'Quotation payload:',
      payload
    );

  }


  getSelectedVehicleText(): string {

    const vehicle =
      this.vehicles.find(
        item =>
          String(item.id) ===
          String(this.selectedVehicle)
      );

    return vehicle
      ? this.getVehicleNumber(vehicle)
      : '';

  }

  private isCustomer(value: unknown): value is Customer {
    if (!this.isRecord(value)) {
      return false;
    }
    return (
      typeof value['customer_name'] === 'string' &&
      (value['id'] === undefined ||
        value['id'] === null ||
        typeof value['id'] === 'number' ||
        typeof value['id'] === 'string') &&
      (value['address'] === undefined ||
        value['address'] === null ||
        typeof value['address'] === 'string')
    );
  }

  private isCustomerDetails(value: unknown): value is CustomerDetails {
    if (!this.isRecord(value)) {
      return false;
    }
    return ['name', 'mobile', 'address', 'bussinessName', 'gstNo', 'picture'].every(
      (key) => value[key] === undefined || value[key] === null || typeof value[key] === 'string',
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

}
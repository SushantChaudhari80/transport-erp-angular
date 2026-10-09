import {
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
import { FormsModule } from '@angular/forms';
import { Host } from '../../core/services/host';


interface Vehicle {
  id: number;
  machine_number?: string;
  machineNumber?: string;
}


interface Customer {
  id: number;
  customer_name?: string;
}


interface CustomerDetails {
  name?: string;
  mobile?: string;
  address?: string;
  bussinessName?: string;
}


interface TreepPayload {
  selectedVehicle: string;
  customerName: string;
  soilBrass: number;
  soilRate: number;
  item: string;
  isBilled: boolean;
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

  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');


  // ============================================================
  // State
  // ============================================================

  loading = false;

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

  soilBrass = 0;

  soilRate = 0;


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

    this.http
      .get<Vehicle[]>(
        `${this.apiUrl}/api/vehicles/getAll/loading`
      )
      .subscribe({

        next: (vehicles) => {

          this.vehicles =
            vehicles ?? [];

        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching vehicle data:',
            error
          );

          this.errorMessage =
            'Unable to load vehicles.';
        },
      });
  }


  // ============================================================
  // API: Customers
  // ============================================================

  loadCustomers(): void {

    this.http
      .get<Customer[]>(
        `${this.apiUrl}/api/order/getAll`
      )
      .subscribe({

        next: (customers) => {

          this.customers =
            customers ?? [];

        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching customer data:',
            error
          );

          this.errorMessage =
            'Unable to load customers.';
        },
      });
  }


  // ============================================================
  // API: Customer / Owner Details
  // ============================================================

  loadCustomerDetails(): void {

    this.http
      .get<CustomerDetails>(
        `${this.apiUrl}/api/customers/get`
      )
      .subscribe({

        next: (customer) => {

          this.customerDetails =
            customer;

        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching customer details:',
            error
          );

          this.errorMessage =
            'Unable to load owner details.';
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
      customer =>
        customer.id ===
        this.selectedCustomerId
    );
  }


  get selectedCustomerName(): string {

    return (
      this.selectedCustomer
        ?.customer_name
        ?.trim() || '-'
    );
  }


  // ============================================================
  // Selected Vehicle
  // ============================================================

  get selectedVehicle(): Vehicle | undefined {

    if (this.selectedVehicleId === null) {
      return undefined;
    }

    return this.vehicles.find(
      vehicle =>
        vehicle.id ===
        this.selectedVehicleId
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

    if (this.selectedCustomerId === null) {

      this.errorMessage =
        'Please select a customer.';

      return false;
    }

    if (this.selectedVehicleId === null) {

      this.errorMessage =
        'Please select a vehicle.';

      return false;
    }

    if (!this.selectedMaterial) {

      this.errorMessage =
        'Please select material.';

      return false;
    }

    if (this.soilBrass <= 0) {

      this.errorMessage =
        'Please enter a valid quantity.';

      return false;
    }

    if (this.soilRate < 0) {

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

      isBilled: false,
    };
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

    this.soilBrass = 0;

    this.soilRate = 0;

    this.errorMessage = '';

    this.successMessage = '';
  }
}
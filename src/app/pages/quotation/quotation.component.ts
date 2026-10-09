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
  id?: number;
  customer_name?: string;
  address?: string;
}


interface CustomerDetails {
  name?: string;
  mobile?: string;
  address?: string;
  bussinessName?: string;
  gstNo?: string;
}


interface MaterialRow {
  name: string;
  qty: number;
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

  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');


  // ============================================================
  // Loading
  // ============================================================

  loading = false;

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


  materialRows: MaterialRow[] = [
    {
      name: 'Sand',
      qty: 0,
      rate: 0,
      amount: 0,
    },
    {
      name: 'Bricks',
      qty: 0,
      rate: 0,
      amount: 0,
    },
    {
      name: 'Crush Sand',
      qty: 0,
      rate: 0,
      amount: 0,
    },
    {
      name: 'Cement',
      qty: 0,
      rate: 0,
      amount: 0,
    },
    {
      name: 'Steel',
      qty: 0,
      rate: 0,
      amount: 0,
    },
    {
      name: 'Soil',
      qty: 0,
      rate: 0,
      amount: 0,
    },
    {
      name: 'Others',
      qty: 0,
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

    this.http
      .get<Vehicle[]>(
        `${this.apiUrl}/api/vehicles/getAll/loading`
      )
      .subscribe({

        next: (vehicles) => {

          this.vehicles = vehicles ?? [];
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
  // Load Customers
  // ============================================================

  loadCustomers(): void {

    this.http
      .get<Customer[]>(
        `${this.apiUrl}/api/order/getAll`
      )
      .subscribe({

        next: (customers) => {

          this.customers = customers ?? [];
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
  // Load Company / Customer Details
  // ============================================================

  loadCustomerDetails(): void {

    this.http
      .get<CustomerDetails>(
        `${this.apiUrl}/api/customers/get`
      )
      .subscribe({

        next: (customer) => {

          this.customerDetails = customer;
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching customer details:',
            error
          );

          this.errorMessage =
            'Unable to load customer details.';
        },
      });
  }


  // ============================================================
  // Customer Selection
  // ============================================================

  onCustomerChange(): void {

    const customer = this.customers.find(
      item =>
        String(item.address ?? '') ===
        this.selectedCustomer
    );

    this.selectedCustomerAddress =
      customer?.address ?? '';

  }


  get selectedCustomerName(): string {

    const customer = this.customers.find(
      item =>
        String(item.address ?? '') ===
        this.selectedCustomer
    );

    return customer?.customer_name ?? '-';
  }


  // ============================================================
  // Material
  // ============================================================

  onMaterialChange(): void {

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

    const numberValue =
      Number(value);

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

    return amount.toFixed(2);
  }


  // ============================================================
  // Print
  // ============================================================

  printQuotation(): void {

    window.print();

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


  private getSelectedVehicleText(): string {

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

}
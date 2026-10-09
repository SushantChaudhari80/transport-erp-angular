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
  HttpParams,
} from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Host } from '../../core/services/host';

interface Order {
  id: number;
  order_date?: string;
  customer_name?: string;
  advance?: number;
  status?: string;
  address?: string;
  deliveryDate?: string;
  machins?: string;
}

interface Vehicle {
  machine_number: string;
}

interface CreateOrderForm {
  customer_name: string;
  address: string;
  advance: number | null;
}

interface AppliedOrderFilters {
  status: string;
  fromDate: string;
  toDate: string;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent implements OnInit {

  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  /**
   * Change this to your Spring Boot API URL.
   *
   * Example:
   * http://localhost:8081
   */
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  orders: Order[] = [];
  vehicles: Vehicle[] = [];

  loading = false;
  saving = false;
  creatingOrder = false;
  loadingCreateVehicles = false;

  errorMessage = '';
  successMessage = '';
  createOrderError = '';
  orderCreatedWithoutPayment = false;

  // Filters
  selectedStatus = '';
  fromDate = '';
  toDate = '';
  private appliedFilters: AppliedOrderFilters = {
    status: '',
    fromDate: '',
    toDate: '',
  };

  // View modal
  showViewModal = false;
  selectedOrder: Order | null = null;

  // Update modal
  showUpdateModal = false;
  updateOrder: Order | null = null;

  selectedVehicles = new Set<string>();
  showCreateOrderModal = false;
  createOrderForm: CreateOrderForm = this.emptyCreateOrderForm();
  createSelectedVehicles = new Set<string>();

  readonly statusOptions = [
    'Active',
    'Pending',
    'Complete',
    'Canceled',
  ];

  get filteredOrders(): Order[] {
    const { status, fromDate, toDate } = this.appliedFilters;
    const fromKey = this.toDateKey(fromDate);
    const toKey = this.toDateKey(toDate);

    return this.orders.filter((order) => {
      if (status && order.status?.trim().toLowerCase() !== status.toLowerCase()) {
        return false;
      }

      if (fromKey || toKey) {
        const orderKey = this.toDateKey(order.order_date);
        if (!orderKey || (fromKey && orderKey < fromKey) || (toKey && orderKey > toKey)) {
          return false;
        }
      }

      return true;
    });
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  // ============================================================
  // Orders
  // ============================================================

  loadOrders(): void {

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<unknown>(
        `${this.apiUrl}/api/order/getAll`
      )
      .subscribe({
        next: (response) => {
          if (!Array.isArray(response)) {
            console.error('Unexpected response from orders API:', response);
            this.loading = false;
            this.errorMessage = 'The orders service returned an unexpected response.';
            this.changeDetectorRef.markForCheck();
            return;
          }

          this.orders = [...response].sort(
            (a, b) => (b.id ?? 0) - (a.id ?? 0)
          );

          this.loading = false;
          this.changeDetectorRef.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error('Error fetching orders:', error);

          this.loading = false;

          this.errorMessage =
            'Unable to load orders. Please try again.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  // ============================================================
  // Filters
  // ============================================================

  applyFilters(): void {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.errorMessage = 'From Date must be on or before To Date.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.appliedFilters = {
      status: this.selectedStatus,
      fromDate: this.fromDate,
      toDate: this.toDate,
    };
    this.changeDetectorRef.markForCheck();
  }

  clearFilters(): void {

    this.selectedStatus = '';
    this.fromDate = '';
    this.toDate = '';
    this.appliedFilters = {
      status: '',
      fromDate: '',
      toDate: '',
    };
    this.errorMessage = '';
    this.changeDetectorRef.markForCheck();
  }

  private toDateKey(value?: string): string | null {
    if (!value) {
      return null;
    }

    const dateOnly = value.trim();
    const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(dateOnly);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    const dayFirstMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(dateOnly);
    if (dayFirstMatch) {
      return `${dayFirstMatch[3]}-${dayFirstMatch[2].padStart(2, '0')}-${dayFirstMatch[1].padStart(2, '0')}`;
    }

    const parsedDate = new Date(dateOnly);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return [
      parsedDate.getFullYear(),
      String(parsedDate.getMonth() + 1).padStart(2, '0'),
      String(parsedDate.getDate()).padStart(2, '0'),
    ].join('-');
  }

  // ============================================================
  // View Order
  // ============================================================

  viewOrder(order: Order): void {

    if (!order.id) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<Order>(
        `${this.apiUrl}/api/order/getById`,
        {
          params: new HttpParams()
            .set('id', order.id.toString()),
        }
      )
      .subscribe({
        next: (response) => {

          this.selectedOrder = response;
          this.showViewModal = true;

          this.loading = false;
          this.changeDetectorRef.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching order details:',
            error
          );

          this.loading = false;

          this.errorMessage =
            'Unable to load order details.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  closeViewModal(): void {

    this.showViewModal = false;
    this.selectedOrder = null;
  }

  // ============================================================
  // Update Order
  // ============================================================

  updateOrderDetails(order: Order): void {

    if (!order.id) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<Order>(
        `${this.apiUrl}/api/order/getById`,
        {
          params: new HttpParams()
            .set('id', order.id.toString()),
        }
      )
      .subscribe({
        next: (response) => {

          this.updateOrder = {
            ...response,
          };

          this.selectedVehicles =
            this.parseVehicles(response.machins);

          this.showUpdateModal = true;

          this.loading = false;

          this.loadVehicles();
          this.changeDetectorRef.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching order details:',
            error
          );

          this.loading = false;

          this.errorMessage =
            'Unable to load order details.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  closeUpdateModal(): void {

    if (this.saving) {
      return;
    }

    this.showUpdateModal = false;
    this.updateOrder = null;
    this.selectedVehicles.clear();
  }

  // ============================================================
  // Vehicles
  // ============================================================

  loadVehicles(): void {

    this.http
      .get<Vehicle[]>(
        `${this.apiUrl}/api/vehicles/getAll`
      )
      .subscribe({
        next: (vehicles) => {

          this.vehicles = vehicles ?? [];
          this.changeDetectorRef.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching vehicle data:',
            error
          );

          this.errorMessage =
            'Unable to load vehicles.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  openCreateOrderModal(): void {
    if (this.orderCreatedWithoutPayment) {
      return;
    }

    this.showCreateOrderModal = true;
    this.createOrderError = '';
    this.createOrderForm = this.emptyCreateOrderForm();
    this.createSelectedVehicles.clear();
    this.loadCreateOrderVehicles();
  }

  closeCreateOrderModal(): void {
    if (this.creatingOrder) {
      return;
    }

    this.showCreateOrderModal = false;
    this.createOrderError = '';
  }

  loadCreateOrderVehicles(): void {
    this.loadingCreateVehicles = true;
    this.createOrderError = '';

    this.http.get<unknown>(`${this.apiUrl}/api/vehicles/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response)) {
          console.error('Unexpected response from vehicles API:', response);
          this.createOrderError = 'The vehicles service returned an unexpected response.';
        } else {
          this.vehicles = response;
        }

        this.loadingCreateVehicles = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error fetching vehicles for new order:', error);
        this.loadingCreateVehicles = false;
        this.createOrderError = 'Unable to load vehicles. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  toggleCreateVehicle(machineNumber: string): void {
    if (this.createSelectedVehicles.has(machineNumber)) {
      this.createSelectedVehicles.delete(machineNumber);
    } else {
      this.createSelectedVehicles.add(machineNumber);
    }
  }

  isCreateVehicleSelected(machineNumber: string): boolean {
    return this.createSelectedVehicles.has(machineNumber);
  }

  submitCreateOrder(): void {
    if (this.creatingOrder || this.orderCreatedWithoutPayment) {
      return;
    }

    const customerName = this.createOrderForm.customer_name.trim();
    const customerAddress = this.createOrderForm.address.trim();
    const advance = this.createOrderForm.advance;

    if (!customerName || !customerAddress || advance === null || !Number.isFinite(advance) || advance < 0) {
      this.createOrderError = 'Enter a customer name, address, and a valid non-negative advance payment.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.creatingOrder = true;
    this.createOrderError = '';
    this.orderCreatedWithoutPayment = false;

    const orderPayload = {
      customer_name: customerName,
      address: customerAddress,
      machine_numbers: Array.from(this.createSelectedVehicles).join(','),
      advance,
    };

    this.http
      .post(`${this.apiUrl}/api/order/add`, orderPayload, { responseType: 'text' })
      .subscribe({
        next: (orderResponse) => {
          console.log('Order creation API response:', orderResponse);
          this.creatingOrder = false;
          this.orderCreatedWithoutPayment = true;
          this.showCreateOrderModal = false;
          this.successMessage = 'Order added. Recording advance payment...';
          this.loadOrders();
          this.changeDetectorRef.markForCheck();

          this.http
            .post(
              `${this.apiUrl}/api/payment/add`,
              { customer_name: customerName, amount: advance },
              { responseType: 'text' },
            )
            .subscribe({
              next: (paymentResponse) => {
                console.log('Order advance payment API response:', paymentResponse);
                this.orderCreatedWithoutPayment = false;
                this.successMessage = 'Order and advance payment added successfully.';
                this.changeDetectorRef.markForCheck();
                this.closeCreateOrderModal();
              },
              error: (error: HttpErrorResponse) => {
                console.error('Order was created, but adding its payment failed:', error);
                this.errorMessage =
                  'The order was created, but the advance payment failed. Please contact support before retrying.',
                this.changeDetectorRef.markForCheck();
              },
            });
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error adding order:', error);
          this.finishCreateOrderWithError('Unable to add order. Please try again.');
        },
      });
  }

  private finishCreateOrderWithError(message: string): void {
    this.creatingOrder = false;
    this.createOrderError = message;
    this.changeDetectorRef.markForCheck();
  }

  private emptyCreateOrderForm(): CreateOrderForm {
    return {
      customer_name: '',
      address: '',
      advance: null,
    };
  }

  toggleVehicle(machineNumber: string): void {

    if (this.selectedVehicles.has(machineNumber)) {
      this.selectedVehicles.delete(machineNumber);
    } else {
      this.selectedVehicles.add(machineNumber);
    }
  }

  isVehicleSelected(machineNumber: string): boolean {

    return this.selectedVehicles.has(machineNumber);
  }

  // ============================================================
  // Save Order
  // ============================================================

  saveOrder(): void {

    if (!this.updateOrder || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const updatedOrder = {
      id: this.updateOrder.id,
      customer_name: this.updateOrder.customer_name,
      status: this.updateOrder.status,
      machins: Array.from(this.selectedVehicles).join(','),
      deliveryDate: this.updateOrder.deliveryDate,
      address: this.updateOrder.address,
    };

    this.http
      .post(
        `${this.apiUrl}/api/order/update`,
        updatedOrder
      )
      .subscribe({
        next: (response) => {

          console.log(
            'Order updated successfully:',
            response
          );

          this.saving = false;

          this.showUpdateModal = false;
          this.updateOrder = null;
          this.selectedVehicles.clear();

          this.successMessage =
            'Order updated successfully.';

          this.loadOrders();
          this.changeDetectorRef.markForCheck();

          setTimeout(() => {
            this.successMessage = '';
            this.changeDetectorRef.markForCheck();
          }, 3000);
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error updating order:',
            error
          );

          this.saving = false;

          this.errorMessage =
            'Unable to update order. Please try again.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  // ============================================================
  // Delete
  // ============================================================

  deleteOrder(order: Order): void {

    /**
     * The original JSP only displayed an alert here.
     * There is no delete API in the supplied page.
     *
     * Therefore we do not invent a DELETE endpoint.
     */

    console.log('Delete order ID:', order.id);

    alert(
      `Delete order ID: ${order.id}\n\n` +
      'Delete API is not configured yet.'
    );
  }

  // ============================================================
  // Helpers
  // ============================================================

  parseVehicles(value?: string): Set<string> {

    if (!value) {
      return new Set<string>();
    }

    return new Set(
      value
        .split(',')
        .map(vehicle => vehicle.trim())
        .filter(Boolean)
    );
  }

  getStatusClass(status?: string): string {

    switch (status?.toLowerCase()) {

      case 'complete':
      case 'completed':
      case 'delivered':
        return 'status-complete';

      case 'pending':
        return 'status-pending';

      case 'canceled':
      case 'cancelled':
        return 'status-canceled';

      case 'active':
        return 'status-active';

      default:
        return 'status-default';
    }
  }

  formatDate(date?: string): string {

    if (!date) {
      return '-';
    }

    return date;
  }

  formatAmount(amount?: number): string {

    if (amount === null || amount === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
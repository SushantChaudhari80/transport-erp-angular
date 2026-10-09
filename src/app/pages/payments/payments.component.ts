import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Host } from '../../core/services/host';

interface Customer {
  id: number | string;
  customer_name?: string;
}

interface PaymentRecord {
  id: number | string;
  payment_date?: string;
  customerName?: string;
  payment?: number | string;
  totalDue?: number | string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCustomer(value: unknown): value is Customer {
  return (
    isRecord(value) &&
    (typeof value['id'] === 'number' || typeof value['id'] === 'string') &&
    (value['customer_name'] === undefined || typeof value['customer_name'] === 'string')
  );
}

function isPaymentRecord(value: unknown): value is PaymentRecord {
  return (
    isRecord(value) &&
    (typeof value['id'] === 'number' || typeof value['id'] === 'string') &&
    (value['payment_date'] === undefined || typeof value['payment_date'] === 'string') &&
    (value['customerName'] === undefined || typeof value['customerName'] === 'string') &&
    (value['payment'] === undefined ||
      typeof value['payment'] === 'number' ||
      typeof value['payment'] === 'string') &&
    (value['totalDue'] === undefined ||
      typeof value['totalDue'] === 'number' ||
      typeof value['totalDue'] === 'string')
  );
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  customers: Customer[] = [];
  payments: PaymentRecord[] = [];
  searchTerm = '';
  selectedCustomer = '';
  modalCustomer = '';
  amount: number | null = null;
  loadingPayments = false;
  loadingCustomers = false;
  savingPayment = false;
  showAddModal = false;
  errorMessage = '';
  modalError = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadCustomers();
    this.loadPayments();
  }

  get filteredPayments(): PaymentRecord[] {
    const query = this.searchTerm.trim().toLowerCase();
    return this.payments.filter((payment) => {
      const matchesCustomer =
        !this.selectedCustomer || payment.customerName === this.selectedCustomer;
      const matchesSearch =
        !query ||
        [
          payment.id,
          payment.payment_date,
          payment.customerName,
          payment.payment,
        ].some((value) => String(value ?? '').toLowerCase().includes(query));
      return matchesCustomer && matchesSearch;
    });
  }

  get totalCustomers(): number {
    return new Set(this.payments.map((payment) => payment.customerName?.trim()).filter(Boolean)).size;
  }

  get totalReceived(): number {
    return this.payments.reduce((total, payment) => total + this.numericValue(payment.payment), 0);
  }

  get displayedPaymentTotal(): number {
    return this.filteredPayments.reduce(
      (total, payment) => total + this.numericValue(payment.payment),
      0,
    );
  }

  loadCustomers(): void {
    this.loadingCustomers = true;
    this.http.get<unknown>(`${this.apiUrl}/api/order/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isCustomer)) {
          console.error('Unexpected response from customer list API:', response);
          this.errorMessage = 'The customer service returned an unexpected response.';
          this.customers = [];
        } else {
          const byName = new Map<string, Customer>();
          for (const customer of response) {
            const name = customer.customer_name?.trim();
            if (name) {
              byName.set(name, customer);
            }
          }
          this.customers = [...byName.values()].sort((left, right) =>
            (left.customer_name ?? '').localeCompare(right.customer_name ?? ''),
          );
        }
        this.loadingCustomers = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load payment customers:', error);
        this.loadingCustomers = false;
        this.errorMessage = 'Unable to load customers. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  loadPayments(): void {
    this.loadingPayments = true;
    this.http.get<unknown>(`${this.apiUrl}/api/payment/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isPaymentRecord)) {
          console.error('Unexpected response from payments API:', response);
          this.errorMessage = 'The payment service returned an unexpected response.';
          this.payments = [];
        } else {
          this.payments = [...response].sort((left, right) =>
            this.compareIds(right.id, left.id),
          );
        }
        this.loadingPayments = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load payments:', error);
        this.loadingPayments = false;
        this.errorMessage = 'Unable to load payments. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  viewCustomerPayments(): void {
    if (!this.selectedCustomer) {
      this.errorMessage = 'Select a customer to view their payment history.';
      this.changeDetectorRef.markForCheck();
      return;
    }
    this.errorMessage = '';
    this.searchTerm = '';
  }

  clearCustomerFilter(): void {
    this.selectedCustomer = '';
    this.searchTerm = '';
  }

  openPaymentDetails(payment: PaymentRecord): void {
    const customerName = payment.customerName?.trim();
    if (!customerName) {
      this.errorMessage = 'Payment customer information is unavailable.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    void this.router.navigate(['/payment-details'], {
      queryParams: { customerName },
    });
  }

  openAddModal(): void {
    this.modalCustomer = '';
    this.amount = null;
    this.modalError = '';
    this.showAddModal = true;
  }

  closeAddModal(): void {
    if (this.savingPayment) {
      return;
    }
    this.showAddModal = false;
    this.modalError = '';
  }

  submitPayment(): void {
    if (this.savingPayment) {
      return;
    }
    const customer = this.customers.find(
      (entry) => entry.customer_name === this.modalCustomer,
    );
    if (!customer?.customer_name) {
      this.modalError = 'Select a customer.';
      return;
    }
    if (this.amount === null || !Number.isFinite(this.amount) || this.amount <= 0) {
      this.modalError = 'Enter a payment amount greater than zero.';
      return;
    }

    this.savingPayment = true;
    this.modalError = '';
    this.successMessage = '';
    this.http.post(
      `${this.apiUrl}/api/payment/add`,
      { customerName: customer.customer_name, amount: this.amount },
      { responseType: 'text' },
    ).subscribe({
      next: (response) => {
        console.log('Add payment API response:', response);
        this.savingPayment = false;
        this.showAddModal = false;
        this.successMessage = response.trim() || 'Payment added successfully.';
        this.loadPayments();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to add payment:', error);
        this.savingPayment = false;
        this.modalError = 'Failed to add payment. Please try again.';
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  }

  numericPayment(value: number | string | undefined): number {
    return this.numericValue(value);
  }

  private numericValue(value: number | string | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private compareIds(left: number | string, right: number | string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : String(left).localeCompare(String(right));
  }
}

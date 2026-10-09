import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Host } from '../../core/services/host';

interface MachineBill {
  id: number | string;
  date?: string;
  customer_name?: string;
  v_number?: string;
  total?: number | string;
  end_reading?: number | string;
  total_payment?: number | string;
}

interface DumperBill {
  id: number | string;
  date?: string;
  customer_name?: string;
  v_number?: string;
  total?: number | string;
  rate?: number | string;
  total_payment?: number | string;
}

interface CustomerPayment {
  id: number | string;
  payment_date?: string;
  customerName?: string;
  payment?: number | string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBillRow<T>(value: unknown): value is T {
  return isRecord(value) &&
    (typeof value['id'] === 'number' || typeof value['id'] === 'string');
}

function isCustomerPayment(value: unknown): value is CustomerPayment {
  return isBillRow<CustomerPayment>(value) &&
    (value['payment_date'] === undefined || typeof value['payment_date'] === 'string') &&
    (value['customerName'] === undefined || typeof value['customerName'] === 'string') &&
    (value['payment'] === undefined ||
      typeof value['payment'] === 'number' ||
      typeof value['payment'] === 'string');
}

function isBillReport(value: unknown): value is [MachineBill[], DumperBill[]] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Array.isArray(value[0]) &&
    Array.isArray(value[1]) &&
    value[0].every((item: unknown) => isBillRow<MachineBill>(item)) &&
    value[1].every((item: unknown) => isBillRow<DumperBill>(item))
  );
}

@Component({
  selector: 'app-payment-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-details.component.html',
  styleUrl: './payment-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDetailsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  readonly customerName = this.route.snapshot.queryParamMap.get('customerName')?.trim() ?? '';
  machineBills: MachineBill[] = [];
  dumperBills: DumperBill[] = [];
  payments: CustomerPayment[] = [];
  loading = false;
  errorMessage = '';

  get totalBilled(): number {
    return this.machineBillsTotal + this.dumperBillsTotal;
  }

  get machineBillsTotal(): number {
    return this.machineBills.reduce(
      (sum, bill) => sum + this.numericValue(bill.total_payment),
      0,
    );
  }

  get dumperBillsTotal(): number {
    return this.dumperBills.reduce(
      (sum, bill) => sum + this.numericValue(bill.total_payment),
      0,
    );
  }

  get totalPaid(): number {
    return this.payments.reduce((sum, payment) => sum + this.numericValue(payment.payment), 0);
  }

  get dueAmount(): number {
    return this.totalBilled - this.totalPaid;
  }

  ngOnInit(): void {
    if (!this.customerName) {
      this.errorMessage = 'A customer name is required to view payment details.';
      return;
    }
    this.loadDetails();
  }

  loadDetails(): void {
    if (!this.customerName) {
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    const params = new HttpParams().set('cName', this.customerName);
    forkJoin({
      bills: this.http.get<unknown>(`${this.apiUrl}/api/payment/getAll/byCustomerName`, { params }),
      payments: this.http.get<unknown>(
        `${this.apiUrl}/api/payment/getAll/payments/byCustomerName`,
        { params },
      ),
    }).subscribe({
      next: ({ bills, payments }) => {
        if (!isBillReport(bills)) {
          console.error('Unexpected response from customer bill report API:', bills);
          this.errorMessage = 'The customer bill service returned an unexpected response.';
          this.machineBills = [];
          this.dumperBills = [];
        } else if (!Array.isArray(payments) || !payments.every(isCustomerPayment)) {
          console.error('Unexpected response from customer payment history API:', payments);
          this.errorMessage = 'The customer payment service returned an unexpected response.';
          this.machineBills = [];
          this.dumperBills = [];
          this.payments = [];
        } else {
          this.machineBills = bills[0];
          this.dumperBills = bills[1];
          this.payments = payments;
        }
        this.loading = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load customer payment details:', error);
        this.loading = false;
        this.errorMessage = 'Unable to load this customer’s payment details. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  formatAmount(value: number | string | undefined): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(this.numericValue(value));
  }

  private numericValue(value: number | string | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

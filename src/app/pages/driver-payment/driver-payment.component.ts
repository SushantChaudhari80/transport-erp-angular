import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Host } from '../../core/services/host';

interface DriverDetails {
  id: number;
  driverName: string;
  driverMobile?: string;
  driverSalary?: number | string;
  machineNumber?: string;
  createDate?: string;
}

interface DriverPayment {
  id: number | string;
  driverName?: string;
  date?: string;
  amount?: number | string;
  comment?: string;
  transaction?: string;
}

interface PaymentForm {
  amount: number | null;
  comment: string;
}

function isDriverDetails(value: unknown): value is DriverDetails {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const details = value as Record<string, unknown>;
  return (
    (typeof details['id'] === 'number' || typeof details['id'] === 'string') &&
    typeof details['driverName'] === 'string'
  );
}

function isDriverPayment(value: unknown): value is DriverPayment {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payment = value as Record<string, unknown>;
  return typeof payment['id'] === 'number' || typeof payment['id'] === 'string';
}

@Component({
  selector: 'app-driver-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './driver-payment.component.html',
  styleUrl: './driver-payment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverPaymentComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  readonly driverId = Number(this.route.snapshot.queryParamMap.get('driverId'));
  driverName = this.route.snapshot.queryParamMap.get('driverName')?.trim() ?? '';
  driver: DriverDetails | null = null;
  payments: DriverPayment[] = [];
  loadingDriver = false;
  loadingPayments = false;
  savingPayment = false;
  showPaymentModal = false;
  errorMessage = '';
  paymentError = '';
  successMessage = '';
  paymentForm: PaymentForm = this.emptyPaymentForm();

  get totalPayments(): number {
    return this.payments.length;
  }

  get totalPaidAmount(): number {
    return this.sumPayments('withdrow');
  }

  get totalPayableAmount(): number {
    return this.sumPayments('deposite');
  }

  get totalDue(): number {
    return this.totalPayableAmount - this.totalPaidAmount;
  }

  ngOnInit(): void {
    if (!Number.isSafeInteger(this.driverId) || this.driverId <= 0 || !this.driverName) {
      this.errorMessage = 'A valid driver ID and name are required.';
      return;
    }

    this.loadDriver();
    this.loadPayments();
  }

  loadDriver(): void {
    this.loadingDriver = true;
    this.http.get<unknown>(`${this.apiUrl}/api/driver/getById`, {
      params: new HttpParams().set('drId', this.driverId),
    }).subscribe({
      next: (response) => {
        if (!isDriverDetails(response)) {
          console.error('Unexpected response from driver details API:', response);
          this.errorMessage = 'The driver service returned an unexpected response.';
        } else {
          this.driver = response;
          this.driverName = this.driver.driverName || this.driverName;
        }
        this.loadingDriver = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load driver details:', error);
        this.loadingDriver = false;
        this.errorMessage = 'Unable to load driver details.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  loadPayments(): void {
    this.loadingPayments = true;
    this.http.get<unknown>(`${this.apiUrl}/api/driver/payment/getAll`, {
      params: new HttpParams().set('driverName', this.driverName),
    }).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isDriverPayment)) {
          console.error('Unexpected response from driver payments API:', response);
          this.errorMessage = 'The payment service returned an unexpected response.';
          this.payments = [];
        } else {
          this.payments = response;
        }
        this.loadingPayments = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load driver payments:', error);
        this.loadingPayments = false;
        this.errorMessage = 'Unable to load driver payments.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  openPaymentModal(): void {
    this.paymentForm = this.emptyPaymentForm();
    this.paymentError = '';
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    if (this.savingPayment) {
      return;
    }
    this.showPaymentModal = false;
    this.paymentError = '';
  }

  submitPayment(): void {
    if (this.savingPayment) {
      return;
    }

    const amount = this.paymentForm.amount;
    const comment = this.paymentForm.comment.trim();
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      this.paymentError = 'Enter a payment amount greater than zero.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.savingPayment = true;
    this.paymentError = '';
    const params = new HttpParams()
      .set('driverName', this.driverName)
      .set('amount', amount)
      .set('comment', comment);
    this.http.get(`${this.apiUrl}/api/driver/payment/save`, {
      params,
      responseType: 'text',
    }).subscribe({
      next: (response) => {
        console.log('Save driver payment API response:', response);
        this.savingPayment = false;
        this.showPaymentModal = false;
        this.successMessage = 'Payment submitted successfully.';
        this.loadPayments();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to save driver payment:', error);
        this.savingPayment = false;
        this.paymentError = 'Unable to submit payment. Please try again.';
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  formatAmount(amount: number | string | null | undefined): string {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return '—';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(numericAmount);
  }

  transactionClass(transaction?: string): string {
    switch (transaction?.toLowerCase()) {
      case 'deposite':
        return 'transaction-deposit';
      case 'withdrow':
        return 'transaction-withdrawal';
      default:
        return 'transaction-other';
    }
  }

  private sumPayments(transaction: string): number {
    return this.payments.reduce((total, payment) => {
      if (payment.transaction?.toLowerCase() !== transaction) {
        return total;
      }
      const amount = Number(payment.amount);
      return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  private emptyPaymentForm(): PaymentForm {
    return { amount: null, comment: '' };
  }
}

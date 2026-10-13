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

type LeaveStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface DriverLeave {
  id: number;
  driverName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  adminRemarks?: string | null;
  createdAt?: string;
}

interface LeaveForm {
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
}

interface CalendarDay {
  date: Date;
  isoDate: string;
  inCurrentMonth: boolean;
}

const LEAVE_STATUSES: LeaveStatus[] = ['OPEN', 'APPROVED', 'REJECTED', 'CANCELLED'];

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

function isDriverLeave(value: unknown): value is DriverLeave {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const leave = value as Record<string, unknown>;
  return (
    typeof leave['id'] === 'number' &&
    Number.isSafeInteger(leave['id']) &&
    typeof leave['driverName'] === 'string' &&
    typeof leave['leaveType'] === 'string' &&
    typeof leave['fromDate'] === 'string' &&
    typeof leave['toDate'] === 'string' &&
    typeof leave['reason'] === 'string' &&
    typeof leave['status'] === 'string' &&
    LEAVE_STATUSES.includes(leave['status'] as LeaveStatus)
  );
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  showLeaveModal = false;
  showLeaveForm = false;
  loadingLeaves = false;
  savingLeave = false;
  leaveBusyId: number | null = null;
  leaveRequests: DriverLeave[] = [];
  leaveMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  selectedLeaveStatus = '';
  selectedLeaveType = '';
  leaveSearch = '';
  adminRemarks = '';
  leaveError = '';
  leaveSuccess = '';
  leaveFormError = '';
  leaveForm: LeaveForm = this.emptyLeaveForm();
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

  get leaveMonthTitle(): string {
    return new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
    }).format(this.leaveMonth);
  }

  get calendarDays(): CalendarDay[] {
    const firstDay = new Date(this.leaveMonth.getFullYear(), this.leaveMonth.getMonth(), 1);
    const offset = firstDay.getDay();
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date,
        isoDate: toDateString(date),
        inCurrentMonth: date.getMonth() === this.leaveMonth.getMonth(),
      };
    });
  }

  get monthLeaveRequests(): DriverLeave[] {
    const monthStart = new Date(this.leaveMonth.getFullYear(), this.leaveMonth.getMonth(), 1);
    const monthEnd = new Date(this.leaveMonth.getFullYear(), this.leaveMonth.getMonth() + 1, 0);
    const monthStartString = toDateString(monthStart);
    const monthEndString = toDateString(monthEnd);

    return this.leaveRequests.filter((leave) =>
      leave.driverName === this.driverName &&
      (!this.selectedLeaveStatus || leave.status === this.selectedLeaveStatus) &&
      (!this.selectedLeaveType || leave.leaveType === this.selectedLeaveType) &&
      (!this.leaveSearch.trim() ||
        leave.driverName.toLowerCase().includes(this.leaveSearch.trim().toLowerCase()) ||
        String(leave.id).includes(this.leaveSearch.trim()) ||
        leave.leaveType.toLowerCase().includes(this.leaveSearch.trim().toLowerCase())) &&
      leave.fromDate <= monthEndString &&
      leave.toDate >= monthStartString
    );
  }

  get leaveTypeOptions(): string[] {
    const monthStart = toDateString(
      new Date(this.leaveMonth.getFullYear(), this.leaveMonth.getMonth(), 1),
    );
    const monthEnd = toDateString(
      new Date(this.leaveMonth.getFullYear(), this.leaveMonth.getMonth() + 1, 0),
    );
    return [...new Set(this.leaveRequests
      .filter((leave) =>
        leave.driverName === this.driverName &&
        leave.fromDate <= monthEnd &&
        leave.toDate >= monthStart
      )
      .map((leave) => leave.leaveType))]
      .sort((first, second) => first.localeCompare(second));
  }

  get openLeaveCount(): number {
    return this.monthLeaveRequests.filter((leave) => leave.status === 'OPEN').length;
  }

  get approvedLeaveCount(): number {
    return this.monthLeaveRequests.filter((leave) => leave.status === 'APPROVED').length;
  }

  get rejectedLeaveCount(): number {
    return this.monthLeaveRequests.filter((leave) => leave.status === 'REJECTED').length;
  }

  get cancelledLeaveCount(): number {
    return this.monthLeaveRequests.filter((leave) => leave.status === 'CANCELLED').length;
  }

  get leaveMinDate(): string {
    return toDateString(new Date());
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

  openLeaveModal(): void {
    this.showLeaveModal = true;
    this.showLeaveForm = false;
    this.leaveError = '';
    this.leaveSuccess = '';
    this.leaveFormError = '';
    this.selectedLeaveStatus = '';
    this.selectedLeaveType = '';
    this.leaveSearch = '';
    this.adminRemarks = '';
    this.leaveForm = this.emptyLeaveForm();
    this.loadLeaveRequests();
  }

  closeLeaveModal(): void {
    if (this.savingLeave || this.leaveBusyId !== null) {
      return;
    }
    this.showLeaveModal = false;
    this.showLeaveForm = false;
    this.leaveError = '';
  }

  loadLeaveRequests(): void {
    this.loadingLeaves = true;
    this.leaveError = '';
    this.http.get<unknown>(
      `${this.apiUrl}/api/driver-leaves/driver/${encodeURIComponent(this.driverName)}`,
    ).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isDriverLeave)) {
          console.error('Unexpected response from driver leaves API:', response);
          this.leaveError = 'The leave service returned an unexpected response.';
        } else {
          this.leaveRequests = response.map((leave) => ({
            ...leave,
            id: Number(leave.id),
          }));
        }
        this.loadingLeaves = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load driver leave requests:', error);
        this.loadingLeaves = false;
        this.leaveRequests = [];
        this.leaveError = 'Unable to load leave requests. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  openLeaveForm(): void {
    this.leaveForm = this.emptyLeaveForm();
    this.leaveFormError = '';
    this.showLeaveForm = true;
  }

  closeLeaveForm(): void {
    if (this.savingLeave) {
      return;
    }
    this.showLeaveForm = false;
    this.leaveFormError = '';
  }

  submitLeaveRequest(): void {
    if (this.savingLeave) {
      return;
    }

    const request: LeaveForm = {
      leaveType: this.leaveForm.leaveType.trim(),
      fromDate: this.leaveForm.fromDate,
      toDate: this.leaveForm.toDate,
      reason: this.leaveForm.reason.trim(),
    };
    if (
      !this.driverName ||
      !request.leaveType ||
      !request.fromDate ||
      !request.toDate
    ) {
      this.leaveFormError = 'Complete all required fields.';
      this.changeDetectorRef.markForCheck();
      return;
    }
    if (request.toDate < request.fromDate) {
      this.leaveFormError = 'The end date cannot be before the start date.';
      this.changeDetectorRef.markForCheck();
      return;
    }
    if (request.fromDate < this.leaveMinDate) {
      this.leaveFormError = 'Leave cannot start in the past.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.savingLeave = true;
    this.leaveFormError = '';
    this.http.post<unknown>(`${this.apiUrl}/api/driver-leaves`, {
      ...request,
      driverName: this.driverName,
    }).subscribe({
      next: (response) => {
        if (!isDriverLeave(response)) {
          console.error('Unexpected response from create leave API:', response);
          this.savingLeave = false;
          this.leaveFormError = 'The leave service returned an unexpected response.';
          this.changeDetectorRef.markForCheck();
          return;
        }
        this.savingLeave = false;
        this.showLeaveForm = false;
        this.leaveMonth = new Date(
          Number(request.fromDate.slice(0, 4)),
          Number(request.fromDate.slice(5, 7)) - 1,
          1,
        );
        this.leaveSuccess = 'Leave request created successfully.';
        this.loadLeaveRequests();
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to create driver leave request:', error);
        this.savingLeave = false;
        this.leaveFormError = this.apiErrorMessage(error, 'Unable to create leave request.');
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  changeLeaveMonth(offset: number): void {
    this.leaveMonth = new Date(
      this.leaveMonth.getFullYear(),
      this.leaveMonth.getMonth() + offset,
      1,
    );
  }

  leavesForDay(day: CalendarDay): DriverLeave[] {
    return this.monthLeaveRequests.filter(
      (leave) => leave.fromDate <= day.isoDate && leave.toDate >= day.isoDate,
    );
  }

  isLeaveDetailDay(leave: DriverLeave, day: CalendarDay): boolean {
    if (day.isoDate === leave.fromDate) {
      return true;
    }
    const monthStart = toDateString(
      new Date(this.leaveMonth.getFullYear(), this.leaveMonth.getMonth(), 1),
    );
    return day.inCurrentMonth && leave.fromDate < monthStart && day.isoDate === monthStart;
  }

  leaveDayCount(leave: DriverLeave): number {
    const [fromYear, fromMonth, fromDay] = leave.fromDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = leave.toDate.split('-').map(Number);
    const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
    const to = Date.UTC(toYear, toMonth - 1, toDay);
    return Math.floor((to - from) / 86_400_000) + 1;
  }

  formatLeaveDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  updateLeaveStatus(leave: DriverLeave, status: 'APPROVED' | 'REJECTED'): void {
    const action = status === 'APPROVED' ? 'Approve' : 'Reject';
    if (
      leave.status !== 'OPEN' ||
      this.leaveBusyId !== null ||
      !window.confirm(`${action} leave request #${leave.id} for ${leave.driverName}?`)
    ) {
      return;
    }

    this.leaveBusyId = leave.id;
    this.leaveError = '';
    this.leaveSuccess = '';
    let params = new HttpParams().set('status', status);
    const remarks = this.adminRemarks.trim();
    if (remarks) {
      params = params.set('adminRemarks', remarks);
    }
    this.http.patch<unknown>(
      `${this.apiUrl}/api/driver-leaves/${leave.id}/status`,
      null,
      { params },
    ).subscribe({
      next: (response) => {
        if (!isDriverLeave(response)) {
          console.error('Unexpected response from update leave status API:', response);
          this.leaveBusyId = null;
          this.leaveError = 'The leave service returned an unexpected response.';
          this.changeDetectorRef.markForCheck();
          return;
        }
        this.leaveBusyId = null;
        this.leaveSuccess = `Leave request #${leave.id} ${status.toLowerCase()}.`;
        this.loadLeaveRequests();
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to update driver leave status:', error);
        this.leaveBusyId = null;
        this.leaveError = this.apiErrorMessage(error, 'Unable to update leave request.');
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  deleteLeaveRequest(leave: DriverLeave): void {
    if (
      leave.status === 'APPROVED' ||
      this.leaveBusyId !== null ||
      !window.confirm(`Delete leave request #${leave.id} for ${leave.driverName}?`)
    ) {
      return;
    }

    this.leaveBusyId = leave.id;
    this.leaveError = '';
    this.leaveSuccess = '';
    this.http.delete(`${this.apiUrl}/api/driver-leaves/${leave.id}`).subscribe({
      next: () => {
        this.leaveBusyId = null;
        this.leaveSuccess = `Leave request #${leave.id} deleted.`;
        this.loadLeaveRequests();
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to delete driver leave request:', error);
        this.leaveBusyId = null;
        this.leaveError = this.apiErrorMessage(error, 'Unable to delete leave request.');
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  leaveStatusClass(status: LeaveStatus): string {
    return `leave-status-${status.toLowerCase()}`;
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

  private emptyLeaveForm(): LeaveForm {
    return {
      leaveType: '',
      fromDate: '',
      toDate: '',
      reason: '',
    };
  }

  private apiErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error === 'object' && error.error !== null) {
      const message = (error.error as Record<string, unknown>)['message'];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return typeof error.error === 'string' && error.error.trim()
      ? error.error
      : fallback;
  }
}

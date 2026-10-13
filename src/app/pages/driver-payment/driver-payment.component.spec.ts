import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Host } from '../../core/services/host';
import { DriverPaymentComponent } from './driver-payment.component';

describe('DriverPaymentComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'driver-payment', component: DriverPaymentComponent },
        ]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('should load driver details and payment history, then calculate totals', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/driver-payment?driverId=12&driverName=Omkar%20Darekar',
      DriverPaymentComponent,
    );

    httpTesting.expectOne(`${apiUrl}/api/driver/getById?drId=12`).flush({
      id: 12,
      driverName: 'Omkar Darekar',
      driverMobile: '9876543210',
      driverSalary: 25000,
      machineNumber: 'MH16BH2818',
      createDate: '2025-08-12',
    });
    httpTesting.expectOne(
      `${apiUrl}/api/driver/payment/getAll?driverName=Omkar%20Darekar`,
    ).flush([
      { id: 1, amount: '2000', transaction: 'withdrow' },
      { id: 2, amount: '5000', transaction: 'deposite' },
      { id: 3, amount: '100', transaction: 'other' },
    ]);
    harness.detectChanges();

    expect(page.driver?.driverMobile).toBe('9876543210');
    expect(page.totalPayments).toBe(3);
    expect(page.totalPaidAmount).toBe(2000);
    expect(page.totalPayableAmount).toBe(5000);
    expect(page.totalDue).toBe(3000);
    expect(harness.routeNativeElement?.textContent).toContain('MH16BH2818');
    expect(harness.routeNativeElement?.textContent).toContain('Total Due');
  });

  it('should save a payment and refresh the history', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/driver-payment?driverId=12&driverName=Omkar%20Darekar',
      DriverPaymentComponent,
    );
    httpTesting.expectOne(`${apiUrl}/api/driver/getById?drId=12`).flush({
      id: 12,
      driverName: 'Omkar Darekar',
    });
    httpTesting.expectOne(
      `${apiUrl}/api/driver/payment/getAll?driverName=Omkar%20Darekar`,
    ).flush([]);
    harness.detectChanges();

    page.openPaymentModal();
    page.paymentForm = { amount: 1800, comment: 'Monthly payment' };
    page.submitPayment();
    const saveRequest = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/api/driver/payment/save` &&
        request.params.get('driverName') === 'Omkar Darekar' &&
        request.params.get('amount') === '1800' &&
        request.params.get('comment') === 'Monthly payment',
    );
    expect(saveRequest.request.method).toBe('GET');
    saveRequest.flush('Payment saved successfully');
    harness.detectChanges();

    expect(page.showPaymentModal).toBe(false);
    expect(harness.routeNativeElement?.querySelector('[role="dialog"]')).toBeNull();
    expect(page.successMessage).toBe('Payment submitted successfully.');
    httpTesting.expectOne(
      `${apiUrl}/api/driver/payment/getAll?driverName=Omkar%20Darekar`,
    ).flush([{ id: 4, amount: 1800, transaction: 'withdrow' }]);
  });

  it('should reject an invalid payment amount without calling the API', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/driver-payment?driverId=12&driverName=Omkar%20Darekar',
      DriverPaymentComponent,
    );
    httpTesting.expectOne(`${apiUrl}/api/driver/getById?drId=12`).flush({
      id: 12,
      driverName: 'Omkar Darekar',
    });
    httpTesting.expectOne(
      `${apiUrl}/api/driver/payment/getAll?driverName=Omkar%20Darekar`,
    ).flush([]);

    page.openPaymentModal();
    page.paymentForm.amount = 0;
    page.submitPayment();

    expect(page.paymentError).toBe('Enter a payment amount greater than zero.');
    expect(page.savingPayment).toBe(false);
    httpTesting.expectNone(`${apiUrl}/api/driver/payment/save`);
    harness.detectChanges();
  });

  it('should show only the current driver leave requests by month', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/driver-payment?driverId=12&driverName=Omkar%20Darekar',
      DriverPaymentComponent,
    );
    httpTesting.expectOne(`${apiUrl}/api/driver/getById?drId=12`).flush({
      id: 12,
      driverName: 'Omkar Darekar',
    });
    httpTesting.expectOne(
      `${apiUrl}/api/driver/payment/getAll?driverName=Omkar%20Darekar`,
    ).flush([]);

    page.openLeaveModal();
    const driverLeavesUrl = `${apiUrl}/api/driver-leaves/driver/Omkar%20Darekar`;
    httpTesting.expectOne(driverLeavesUrl).flush([
      {
        id: 1,
        driverName: 'Omkar Darekar',
        leaveType: 'Casual Leave',
        fromDate: '2026-10-20',
        toDate: '2026-10-22',
        reason: 'Personal work',
        status: 'OPEN',
      },
      {
        id: 2,
        driverName: 'Other Driver',
        leaveType: 'Sick Leave',
        fromDate: '2026-10-15',
        toDate: '2026-10-16',
        reason: 'Medical rest',
        status: 'APPROVED',
      },
    ]);

    page.leaveMonth = new Date(2026, 9, 1);
    harness.detectChanges();
    expect(page.monthLeaveRequests.map((leave) => leave.id)).toEqual([1]);
    expect(page.calendarDays).toHaveLength(42);
    expect(harness.routeNativeElement?.textContent).toContain('Leave Management');

    expect(page.monthLeaveRequests.every((leave) => leave.driverName === 'Omkar Darekar')).toBe(true);
    page.leaveSearch = '1';
    expect(page.monthLeaveRequests.map((leave) => leave.id)).toEqual([1]);
    page.leaveSearch = '';
    page.changeLeaveMonth(1);
    expect(page.monthLeaveRequests).toHaveLength(0);
  });

  it('should create leave for the current driver without asking to select a driver', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/driver-payment?driverId=12&driverName=Omkar%20Darekar',
      DriverPaymentComponent,
    );
    httpTesting.expectOne(`${apiUrl}/api/driver/getById?drId=12`).flush({
      id: 12,
      driverName: 'Omkar Darekar',
    });
    httpTesting.expectOne(
      `${apiUrl}/api/driver/payment/getAll?driverName=Omkar%20Darekar`,
    ).flush([]);
    page.openLeaveModal();
    const driverLeavesUrl = `${apiUrl}/api/driver-leaves/driver/Omkar%20Darekar`;
    httpTesting.expectOne(driverLeavesUrl).flush([]);

    page.openLeaveForm();
    page.leaveForm = {
      leaveType: 'Casual Leave',
      fromDate: '2099-10-20',
      toDate: '2099-10-22',
      reason: 'Personal work',
    };
    page.submitLeaveRequest();

    const createRequest = httpTesting.expectOne(`${apiUrl}/api/driver-leaves`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({
      ...page.leaveForm,
      driverName: 'Omkar Darekar',
    });
    createRequest.flush({
      id: 3,
      ...page.leaveForm,
      driverName: 'Omkar Darekar',
      status: 'OPEN',
    });
    expect(page.showLeaveForm).toBe(false);
    expect(page.leaveSuccess).toBe('Leave request created successfully.');
    httpTesting.expectOne(driverLeavesUrl).flush([]);
  });

  it('should approve an open leave request with optional admin remarks', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/driver-payment?driverId=12&driverName=Omkar%20Darekar',
      DriverPaymentComponent,
    );
    httpTesting.expectOne(`${apiUrl}/api/driver/getById?drId=12`).flush({
      id: 12,
      driverName: 'Omkar Darekar',
    });
    httpTesting.expectOne(
      `${apiUrl}/api/driver/payment/getAll?driverName=Omkar%20Darekar`,
    ).flush([]);
    page.openLeaveModal();
    const leave = {
      id: 5,
      driverName: 'Omkar Darekar',
      leaveType: 'Sick Leave',
      fromDate: '2026-10-15',
      toDate: '2026-10-16',
      reason: 'Medical rest',
      status: 'OPEN',
    };
    const driverLeavesUrl = `${apiUrl}/api/driver-leaves/driver/Omkar%20Darekar`;
    httpTesting.expectOne(driverLeavesUrl).flush([leave]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    page.adminRemarks = 'Approved';
    page.updateLeaveStatus(page.leaveRequests[0], 'APPROVED');

    const updateRequest = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/api/driver-leaves/5/status` &&
        request.params.get('status') === 'APPROVED' &&
        request.params.get('adminRemarks') === 'Approved',
    );
    expect(updateRequest.request.method).toBe('PATCH');
    updateRequest.flush({ ...leave, status: 'APPROVED', adminRemarks: 'Approved' });

    expect(page.leaveSuccess).toBe('Leave request #5 approved.');
    httpTesting.expectOne(driverLeavesUrl).flush([]);
  });
});

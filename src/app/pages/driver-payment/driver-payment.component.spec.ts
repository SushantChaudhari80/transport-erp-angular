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
});

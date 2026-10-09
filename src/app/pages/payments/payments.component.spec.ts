import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Host } from '../../core/services/host';
import { PaymentDetailsComponent } from '../payment-details/payment-details.component';
import { PaymentsComponent } from './payments.component';

describe('PaymentsComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'payments', component: PaymentsComponent },
          { path: 'payment-details', component: PaymentDetailsComponent },
        ]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads customers and payment history and calculates received totals', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/payments', PaymentsComponent);

    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Acme Transport' },
      { id: 2, customer_name: 'Beta Hauling' },
      { id: 3, customer_name: 'Acme Transport' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/payment/getAll`).flush([
      { id: 1, payment_date: '2026-10-01', customerName: 'Acme Transport', payment: '1200' },
      { id: 2, payment_date: '2026-10-02', customerName: 'Beta Hauling', payment: 800 },
    ]);
    harness.detectChanges();

    expect(component.customers).toHaveLength(2);
    expect(component.totalCustomers).toBe(2);
    expect(component.totalReceived).toBe(2000);
    component.selectedCustomer = 'Acme Transport';
    component.viewCustomerPayments();
    expect(component.filteredPayments.map((payment) => payment.id)).toEqual([1]);
  });

  it('adds a payment and reloads payment history', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/payments', PaymentsComponent);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Acme Transport' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/payment/getAll`).flush([]);

    component.openAddModal();
    component.modalCustomer = 'Acme Transport';
    component.amount = 1250;
    component.submitPayment();

    const request = httpTesting.expectOne(`${apiUrl}/api/payment/add`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      customerName: 'Acme Transport',
      amount: 1250,
    });
    request.flush('Payment added successfully');
    harness.detectChanges();

    expect(component.showAddModal).toBe(false);
    expect(component.successMessage).toBe('Payment added successfully');
    httpTesting.expectOne(`${apiUrl}/api/payment/getAll`).flush([
      { id: 1, customerName: 'Acme Transport', payment: 1250 },
    ]);
  });

  it('validates customer and amount before submitting a payment', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/payments', PaymentsComponent);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Acme Transport' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/payment/getAll`).flush([]);

    component.openAddModal();
    component.modalCustomer = 'Acme Transport';
    component.amount = 0;
    component.submitPayment();

    expect(component.modalError).toBe('Enter a payment amount greater than zero.');
    expect(component.savingPayment).toBe(false);
    httpTesting.expectNone(`${apiUrl}/api/payment/add`);
    harness.detectChanges();
  });

  it('opens the customer detail report from a payment row eye action', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/payments', PaymentsComponent);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/payment/getAll`).flush([
      { id: 17, customerName: 'Acme Transport', payment: 1250 },
    ]);
    harness.detectChanges();

    component.openPaymentDetails(component.payments[0]);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/payment-details?customerName=Acme%20Transport');
    const billsRequest = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/api/payment/getAll/byCustomerName` &&
        request.params.get('cName') === 'Acme Transport',
    );
    const paymentsRequest = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/api/payment/getAll/payments/byCustomerName` &&
        request.params.get('cName') === 'Acme Transport',
    );
    billsRequest.flush([[], []]);
    paymentsRequest.flush([]);
  });
});

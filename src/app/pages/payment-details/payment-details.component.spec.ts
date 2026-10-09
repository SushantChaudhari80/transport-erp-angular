import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Host } from '../../core/services/host';
import { PaymentDetailsComponent } from './payment-details.component';

describe('PaymentDetailsComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'payment-details', component: PaymentDetailsComponent },
        ]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads machine bills, dumper bills, and payment history to calculate account totals', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/payment-details?customerName=Acme%20Transport',
      PaymentDetailsComponent,
    );
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

    billsRequest.flush([
      [{ id: 1, total_payment: '12000' }],
      [{ id: 2, total_payment: '3500' }],
    ]);
    paymentsRequest.flush([
      { id: 8, customerName: 'Acme Transport', payment: '5000' },
      { id: 9, customerName: 'Acme Transport', payment: 1500 },
    ]);
    harness.detectChanges();

    expect(component.machineBillsTotal).toBe(12000);
    expect(component.dumperBillsTotal).toBe(3500);
    expect(component.totalBilled).toBe(15500);
    expect(component.totalPaid).toBe(6500);
    expect(component.dueAmount).toBe(9000);
    expect(harness.routeNativeElement?.textContent).toContain('Machine Report');
    expect(harness.routeNativeElement?.textContent).toContain('Dumper Payment');
    expect(harness.routeNativeElement?.textContent).toContain('Payment History');
  });

  it('shows the API error and stops loading when the customer report fails', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/payment-details?customerName=Acme%20Transport',
      PaymentDetailsComponent,
    );
    httpTesting.expectOne(
      (request) => request.url === `${apiUrl}/api/payment/getAll/payments/byCustomerName`,
    ).flush([]);
    httpTesting.expectOne(
      (request) => request.url === `${apiUrl}/api/payment/getAll/byCustomerName`,
    ).flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toContain('Unable to load');
    expect(harness.routeNativeElement?.textContent).toContain('Retry');
  });
});

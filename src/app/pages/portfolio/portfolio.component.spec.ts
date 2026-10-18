import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Host } from '../../core/services/host';
import { PortfolioComponent } from './portfolio.component';
import { PortfolioResponse } from './portfolio-calculations';

describe('PortfolioComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  const portfolioResponse: PortfolioResponse = {
    customer_name: 'Tanvi Chaudhari',
    machine_numbers: ['MH16BH2818'],
    orders: [{
      id: 1,
      status: 'Active',
      advance: '5000',
      machins: 'MH16BH2818',
      order_date: '05/06/2026',
      delivery_date: '',
      customer_name: 'Tanvi Chaudhari',
    }],
    invoices: [{
      id: 'INV-1',
      invoice: '<html><body>Total Invoice Value: 175</body></html>',
      billed_date: '11/10/2026',
      customer_name: 'Tanvi Chaudhari',
    }],
    payments: [{
      id: 1,
      payment: '5000',
      payment_date: '05/06/2026',
      customer_name: 'Tanvi Chaudhari',
    }],
    vehicles: [{
      id: 1,
      machine_number: 'MH16BH2818',
      company: 'TATA',
      v_type: 'Excavator',
    }],
    drivers: [{
      id: 1,
      driver_name: 'Omkar Dareker',
      machine_number: 'MH16BH2818',
      driver_salary: '15000',
    }],
    driver_payments: [{
      id: 1,
      driver_name: 'Omkar Dareker',
      amount: '2000',
      transaction: 'Deposite',
      payment_date: '09/06/2026',
    }],
    vouchers: [{
      id: 1,
      amount: '1500',
      create_date: '2026-10-03',
      driver_name: 'Omkar Dareker',
      machine_number: 'MH16BH2818',
      user_comment: 'Vehicle expense',
    }],
    dumper_trips: [{
      id: 16,
      item: 'Bricks',
      diesel: null,
      advance: null,
      is_billed: 'true',
      soil_rate: '100',
      soil_brass: '1',
      total_payment: '100',
      create_date: '10/10/2026',
      submitted_by: 'Admin',
      customer_name: 'Tanvi Chaudhari',
      selected_vehicle: 'MH16BH2818',
    }],
    machine_readings: [
      {
        billed: null,
        diesel: '500',
        fuel_rate: '98.2',
        order_name: 'Tanvi Chaudhari',
        driver_name: null,
        petrol_pump: 'Indian Oil Corporation (IOCL)',
        reading_date: '11/10/2026',
        machine_number: 'MH16BH2818',
      },
      {
        billed: 'true',
        diesel: '110',
        order_name: 'Tanvi Chaudhari',
        driver_name: 'Omkar Dareker',
        end_reading: '14944.5',
        start_reading: '14936.2',
        reading_date: '09/06/2026',
        machine_number: 'MH16BH2818',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfolioComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads customer choices from orders, then requests and displays the chosen portfolio', () => {
    const fixture = TestBed.createComponent(PortfolioComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Tanvi Chaudhari' },
      { id: 2, customer_name: 'Tanvi Chaudhari' },
      { id: 3, customer_name: 'Deepika Kale' },
      { id: 4, customer_name: ' ' },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.customers).toEqual(['Deepika Kale', 'Tanvi Chaudhari']);
    component.selectedCustomer = 'Tanvi Chaudhari';
    component.selectCustomer();

    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === `${apiUrl}/api/portfolio` &&
        candidate.params.get('customerName') === 'Tanvi Chaudhari',
    );
    expect(request.request.method).toBe('GET');
    request.flush(portfolioResponse);
    fixture.detectChanges();

    expect(component.portfolio?.customer_name).toBe('Tanvi Chaudhari');
    expect(component.metrics?.orderCount).toBe(1);
    expect(component.metrics?.customerPayments).toBe(5000);
    expect(component.metrics?.recordedFuelLiters).toBe(610);
    expect(component.metrics?.totalMachineHours).toBeCloseTo(8.3);
    expect(component.metrics?.totalOrderValue).toBeCloseTo(20850);
    expect(component.metrics?.outstandingBalance).toBeCloseTo(15850);
    expect(component.metrics?.invoiceCount).toBe(1);
    expect(component.metrics?.estimatedProfit).toBeCloseTo(-42430);
    expect(fixture.nativeElement.textContent).toContain('Tanvi Chaudhari');
    expect(fixture.nativeElement.textContent).toContain('Not available');
    expect(fixture.nativeElement.textContent).toContain('Recorded fuel (L)');
    expect(fixture.nativeElement.textContent).toContain('610 L');
    expect(fixture.nativeElement.textContent).toContain('Total invoice count');
    expect(fixture.nativeElement.textContent).not.toContain('Total invoiced amount');
    expect(fixture.nativeElement.textContent).toContain('Fuel-only entries excluded');
  });

  it('filters all portfolio activity to the selected order date range', () => {
    const fixture = TestBed.createComponent(PortfolioComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Tanvi Chaudhari' },
    ]);

    const component = fixture.componentInstance;
    component.selectedCustomer = 'Tanvi Chaudhari';
    component.selectCustomer();
    httpTesting.expectOne(
      (candidate) =>
        candidate.url === `${apiUrl}/api/portfolio` &&
        candidate.params.get('customerName') === 'Tanvi Chaudhari',
    ).flush({
      customer_name: 'Tanvi Chaudhari',
      machine_numbers: [],
      orders: [
        { id: 10, order_date: '01/06/2026', delivery_date: '03/06/2026', status: 'Completed' },
        { id: 11, order_date: '04/06/2026', delivery_date: '', status: 'Pending' },
      ],
      invoices: [
        { id: 1, billed_date: '02/06/2026' },
        { id: 2, billed_date: '05/06/2026' },
      ],
      payments: [
        { id: 1, payment_date: '02/06/2026', payment: '100' },
        { id: 2, payment_date: '05/06/2026', payment: '200' },
      ],
      vehicles: [],
      drivers: [],
      driver_payments: [
        { id: 1, payment_date: '02/06/2026', amount: '50' },
        { id: 2, payment_date: '05/06/2026', amount: '200' },
      ],
      vouchers: [
        { id: 1, create_date: '02/06/2026', amount: '25' },
        { id: 2, create_date: '05/06/2026', amount: '100' },
      ],
      dumper_trips: [
        { id: 1, create_date: '02/06/2026', total_payment: '100', is_billed: 'true' },
        { id: 2, create_date: '05/06/2026', total_payment: '200', is_billed: 'false' },
      ],
      machine_readings: [
        {
          id: 1,
          reading_date: '02/06/2026',
          start_reading: '100',
          end_reading: '110',
          billed: 'true',
          driver_name: 'Driver',
          diesel: '1',
        },
        {
          id: 2,
          reading_date: '05/06/2026',
          start_reading: '200',
          end_reading: '215',
          billed: 'false',
          driver_name: 'Driver',
          diesel: '2',
        },
      ],
    });
    fixture.detectChanges();

    expect(component.orderChoices.map((choice) => choice.label)).toEqual([
      'Order #10 · Completed · 01/06/2026 – 03/06/2026',
      'Order #11 · In process · 04/06/2026 – Today',
    ]);

    component.selectedOrderIndex = '0';
    component.onOrderSelectionChanged();
    fixture.detectChanges();

    expect(component.fromDate).toBe('2026-06-01');
    expect(component.toDate).toBe('2026-06-03');
    expect(component.filteredOrders.map((order) => order['id'])).toEqual([10]);
    expect(component.filteredInvoices.map((invoice) => invoice['id'])).toEqual([1]);
    expect(component.filteredPayments.map((payment) => payment['id'])).toEqual([1]);
    expect(component.filteredDriverPayments.map((payment) => payment['id'])).toEqual([1]);
    expect(component.filteredVouchers.map((voucher) => voucher['id'])).toEqual([1]);
    expect(component.metrics?.driverPaymentVolume).toBe(50);
    expect(component.metrics?.voucherAmount).toBe(25);
    expect(component.filteredTrips.map((trip) => trip['id'])).toEqual([1]);
    expect(component.filteredReadings.map((reading) => reading['id'])).toEqual([1]);
    expect(component.metrics?.totalMachineHours).toBe(10);

    component.selectedOrderIndex = '1';
    component.onOrderSelectionChanged();
    fixture.detectChanges();

    expect(component.fromDate).toBe('2026-06-04');
    const today = new Date();
    expect(component.toDate).toBe([
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-'));
    expect(component.filteredOrders.map((order) => order['id'])).toEqual([11]);
    expect(component.filteredInvoices.map((invoice) => invoice['id'])).toEqual([2]);
    expect(component.filteredPayments.map((payment) => payment['id'])).toEqual([2]);
    expect(component.filteredDriverPayments.map((payment) => payment['id'])).toEqual([2]);
    expect(component.filteredVouchers.map((voucher) => voucher['id'])).toEqual([2]);
    expect(component.filteredTrips.map((trip) => trip['id'])).toEqual([2]);
    expect(component.filteredReadings.map((reading) => reading['id'])).toEqual([2]);
    expect(component.metrics?.totalMachineHours).toBe(15);
  });

  it('shows a visible error for malformed portfolio responses', () => {
    const fixture = TestBed.createComponent(PortfolioComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Tanvi Chaudhari' },
    ]);

    const component = fixture.componentInstance;
    component.selectedCustomer = 'Tanvi Chaudhari';
    component.selectCustomer();
    httpTesting.expectOne(
      (candidate) =>
        candidate.url === `${apiUrl}/api/portfolio` &&
        candidate.params.get('customerName') === 'Tanvi Chaudhari',
    ).flush({ customer_name: 'Tanvi Chaudhari', orders: [] });
    fixture.detectChanges();

    expect(component.errorMessage).toContain('unexpected format');
    expect(component.portfolio).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(component.errorMessage);
  });

  it('shows an API error without discarding the selected customer', () => {
    const fixture = TestBed.createComponent(PortfolioComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Tanvi Chaudhari' },
    ]);

    const component = fixture.componentInstance;
    component.selectedCustomer = 'Tanvi Chaudhari';
    component.selectCustomer();
    httpTesting.expectOne(
      (candidate) =>
        candidate.url === `${apiUrl}/api/portfolio` &&
        candidate.params.get('customerName') === 'Tanvi Chaudhari',
    ).flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    expect(component.loadingPortfolio).toBe(false);
    expect(component.selectedCustomer).toBe('Tanvi Chaudhari');
    expect(component.portfolio).toBeNull();
    expect(component.errorMessage).toContain('Unable to load this customer portfolio');
  });
});

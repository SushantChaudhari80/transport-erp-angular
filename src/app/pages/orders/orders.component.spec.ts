import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdersComponent } from './orders.component';

describe('OrdersComponent', () => {
  let fixture: ComponentFixture<OrdersComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersComponent);
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should remove the loading overlay after orders load', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
  });

  it('should stop loading and show an error for an unexpected API response', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush({
      message: 'success',
      data: [],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'The orders service returned an unexpected response.',
    );
  });

  it('should stop loading and show an error when the API request fails', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush(
      { message: 'Server error' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to load orders. Please try again.',
    );
  });

  it('should apply status and inclusive date filters to the existing rows only', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([
      { id: 3, status: 'Active', order_date: '2026-04-01' },
      { id: 2, status: 'Pending', order_date: '2026-04-15' },
      { id: 1, status: 'Active', order_date: '2026-05-01' },
    ]);
    fixture.detectChanges();

    fixture.componentInstance.selectedStatus = 'Active';
    fixture.componentInstance.fromDate = '2026-04-01';
    fixture.componentInstance.toDate = '2026-04-30';

    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredOrders.map((order) => order.id)).toEqual([3]);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('#3');
    httpTesting.expectNone((request) => request.url === 'http://localhost:8081/api/order/getAll');
  });

  it('should reject an inverted date range without changing the applied filters or making a request', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([
      { id: 4, status: 'Active', order_date: '2026-04-15' },
    ]);
    fixture.detectChanges();
    fixture.componentInstance.fromDate = '2026-05-01';
    fixture.componentInstance.toDate = '2026-04-01';

    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage).toBe(
      'From Date must be on or before To Date.',
    );
    expect(fixture.componentInstance.filteredOrders.map((order) => order.id)).toEqual([4]);
    httpTesting.expectNone((request) => request.url === 'http://localhost:8081/api/order/getAll');
  });

  it('should reset filters and show all already loaded orders without another request', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([
      { id: 5, status: 'Pending', order_date: '2026-05-01' },
      { id: 4, status: 'Active', order_date: '2026-04-15' },
    ]);
    fixture.detectChanges();
    fixture.componentInstance.selectedStatus = 'Active';
    fixture.componentInstance.fromDate = '2026-04-01';
    fixture.componentInstance.toDate = '2026-04-30';
    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    fixture.componentInstance.clearFilters();

    expect(fixture.componentInstance.selectedStatus).toBe('');
    expect(fixture.componentInstance.fromDate).toBe('');
    expect(fixture.componentInstance.toDate).toBe('');
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredOrders.map((order) => order.id)).toEqual([5, 4]);
    httpTesting.expectNone((request) => request.url === 'http://localhost:8081/api/order/getAll');
  });

  it('should load vehicle choices when the add-order modal opens', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([]);

    fixture.componentInstance.openCreateOrderModal();
    httpTesting.expectOne('http://localhost:8081/api/vehicles/getAll').flush([
      { machine_number: 'TR-101' },
      { machine_number: 'TR-202' },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('TR-101');
    expect(fixture.nativeElement.textContent).toContain('TR-202');
  });

  it('should create the order, add its advance payment, then refresh the table', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([]);
    fixture.componentInstance.openCreateOrderModal();
    httpTesting.expectOne('http://localhost:8081/api/vehicles/getAll').flush([
      { machine_number: 'TR-101' },
    ]);

    fixture.componentInstance.createOrderForm = {
      customer_name: 'Acme Transport',
      phone_no: '555-0100',
      address: '12 Fleet Road',
      advance: 2500,
    };
    fixture.componentInstance.toggleCreateVehicle('TR-101');
    fixture.componentInstance.submitCreateOrder();

    const orderRequest = httpTesting.expectOne('http://localhost:8081/api/order/add');
    expect(orderRequest.request.method).toBe('POST');
    expect(orderRequest.request.body).toEqual({
      customer_name: 'Acme Transport',
      phone_no: '555-0100',
      address: '12 Fleet Road',
      machine_numbers: 'TR-101',
      advance: 2500,
    });
    orderRequest.flush('Created order #101');
    fixture.detectChanges();
    expect(fixture.componentInstance.showCreateOrderModal).toBe(false);

    const paymentRequest = httpTesting.expectOne('http://localhost:8081/api/payment/add');
    expect(paymentRequest.request.method).toBe('POST');
    expect(paymentRequest.request.body).toEqual({
      customer_name: 'Acme Transport',
      amount: 2500,
    });
    paymentRequest.flush('Payment Added Successfully');

    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([
      { id: 1, customer_name: 'Acme Transport' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.showCreateOrderModal).toBe(false);
    expect(fixture.componentInstance.creatingOrder).toBe(false);
    expect(fixture.componentInstance.successMessage).toBe(
      'Order and advance payment added successfully.',
    );
    expect(fixture.componentInstance.orders).toHaveLength(1);
  });

  it('should report a partial failure if the order is created but payment fails', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([]);
    fixture.componentInstance.openCreateOrderModal();
    httpTesting.expectOne('http://localhost:8081/api/vehicles/getAll').flush([]);
    fixture.componentInstance.createOrderForm = {
      customer_name: 'Acme Transport',
      phone_no: '555-0100',
      address: '12 Fleet Road',
      advance: 2500,
    };

    fixture.componentInstance.submitCreateOrder();
    httpTesting.expectOne('http://localhost:8081/api/order/add').flush('Order added successfully!');
    expect(fixture.componentInstance.showCreateOrderModal).toBe(false);
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([
      { id: 1, customer_name: 'Acme Transport' },
    ]);
    httpTesting.expectOne('http://localhost:8081/api/payment/add').flush(
      { message: 'Payment failed' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.showCreateOrderModal).toBe(false);
    expect(fixture.componentInstance.creatingOrder).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain(
      'order was created, but the advance payment failed',
    );
    expect(fixture.componentInstance.orderCreatedWithoutPayment).toBe(true);
    fixture.componentInstance.submitCreateOrder();
    fixture.componentInstance.openCreateOrderModal();
    httpTesting.expectNone((request) =>
      request.url.endsWith('/api/order/add') || request.url.endsWith('/api/payment/add'),
    );
  });

  it('should validate the new order fields before sending requests', () => {
    httpTesting.expectOne('http://localhost:8081/api/order/getAll').flush([]);
    fixture.componentInstance.createOrderForm = {
      customer_name: 'Acme Transport',
      phone_no: '',
      address: '12 Fleet Road',
      advance: 0,
    };

    fixture.componentInstance.submitCreateOrder();

    expect(fixture.componentInstance.createOrderError).toContain(
      'phone number',
    );
    httpTesting.expectNone((request) =>
      request.url.endsWith('/api/order/add') || request.url.endsWith('/api/payment/add'),
    );
  });
});

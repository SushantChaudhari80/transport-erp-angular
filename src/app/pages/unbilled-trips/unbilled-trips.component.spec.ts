import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Host } from '../../core/services/host';
import { UnbilledTripsComponent } from './unbilled-trips.component';

describe('UnbilledTripsComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnbilledTripsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('loads unbilled trips and calculates visible report totals', () => {
    const fixture = TestBed.createComponent(UnbilledTripsComponent);
    fixture.detectChanges();

    httpTesting.expectOne(`${apiUrl}/api/treep/getAll`).flush([
      {
        id: 5,
        createDate: '2026-10-04',
        item: 'Sand',
        customerName: 'Acme Transport',
        selectedVehicle: 'MH12AB1234',
        diesel: '10',
        advance: '500',
        soilBrass: '20',
        soilRate: '100',
        totalPayment: '2000',
      },
      {
        id: 4,
        createDate: '2026-10-03',
        item: 'Stone',
        customerName: 'Beta Hauling',
        diesel: 5,
        advance: 200,
        totalPayment: 1000,
      },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.trips.map((trip) => trip.id)).toEqual([4, 5]);
    expect(fixture.componentInstance.totalPayment).toBe(3000);
    expect(fixture.componentInstance.totalAdvance).toBe(700);
    expect(fixture.componentInstance.totalDiesel).toBe(15);
    expect(fixture.componentInstance.duePayment).toBe(2300);
    expect(fixture.nativeElement.textContent).toContain('Acme Transport');
  });

  it('filters the trips and totals, and selects only the visible rows', () => {
    const fixture = TestBed.createComponent(UnbilledTripsComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll`).flush([
      { id: 2, customerName: 'Acme Transport', totalPayment: 900, advance: 300, diesel: 4 },
      { id: 1, customerName: 'Beta Hauling', totalPayment: 500, advance: 100, diesel: 2 },
    ]);
    fixture.detectChanges();

    fixture.componentInstance.searchTerm = 'Acme';
    expect(fixture.componentInstance.filteredTrips).toHaveLength(1);
    expect(fixture.componentInstance.totalPayment).toBe(900);
    fixture.componentInstance.toggleVisibleTrips();
    expect(fixture.componentInstance.selectedTrips.map((trip) => trip.id)).toEqual([2]);
  });

  it('allows only one customer per invoice and limits select-all to that customer', () => {
    const fixture = TestBed.createComponent(UnbilledTripsComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll`).flush([
      { id: 3, customerName: 'Acme Transport' },
      { id: 2, customerName: 'Beta Hauling' },
      { id: 1, customerName: 'Acme Transport' },
      { id: 4, customerName: '  ' },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.selectableVisibleTrips.map((trip) => trip.id)).toEqual([1, 3]);
    component.toggleVisibleTrips();
    expect(component.selectedTrips.map((trip) => trip.id)).toEqual([1, 3]);
    expect(component.selectedCustomerName).toBe('Acme Transport');
    expect(component.canSelectTrip(component.trips.find((trip) => trip.id === 2)!)).toBe(false);

    component.toggleTrip(component.trips.find((trip) => trip.id === 2)!);
    expect(component.selectedTrips.map((trip) => trip.id)).toEqual([1, 3]);

    component.toggleVisibleTrips();
    expect(component.selectedTrips).toHaveLength(0);
    expect(component.canSelectTrip(component.trips.find((trip) => trip.id === 2)!)).toBe(true);
    expect(component.canSelectTrip(component.trips.find((trip) => trip.id === 4)!)).toBe(false);
  });

  it('renders API trips with nullable optional fields instead of rejecting the response', () => {
    const fixture = TestBed.createComponent(UnbilledTripsComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll`).flush([
      {
        id: 31,
        createDate: '2026-10-04',
        item: 'Sand',
        customerName: 'Acme Transport',
        selectedVehicle: null,
        diesel: null,
        advance: null,
        soilBrass: null,
        soilRate: null,
        totalPayment: null,
      },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.trips).toHaveLength(1);
    expect(fixture.componentInstance.errorMessage).toBe('');
    expect(fixture.componentInstance.totalPayment).toBe(0);
    expect(fixture.componentInstance.totalAdvance).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Acme Transport');
    expect(fixture.nativeElement.textContent).toContain('31');
  });

  it('calculates an adjusted invoice subtotal and due amount without an advance', () => {
    const fixture = TestBed.createComponent(UnbilledTripsComponent);
    const component = fixture.componentInstance;
    component.trips = [
      { id: 1, soilBrass: 10, soilRate: 20, advance: 25 },
      { id: 2, soilBrass: 5, soilRate: 30, advance: 10 },
    ];
    component.selectedTripIds = new Set(['1', '2']);
    component.soilRateOverride = 40;
    component.gstPercent = 5;

    expect(component.invoiceSubtotal).toBe(600);
    expect(component.invoiceTax).toBe(60);
    expect(component.invoiceTotal).toBe(660);
    expect(component.invoiceDue).toBe(660);
  });

  it('loads owner details, marks selected trips billed, saves, and prints the invoice', () => {
    const fixture = TestBed.createComponent(UnbilledTripsComponent);
    const component = fixture.componentInstance;
    component.trips = [
      { id: 9, customerName: 'Acme', soilBrass: 2, soilRate: 100, advance: 25 },
    ];
    component.selectedTripIds.add('9');
    component.gstPercent = 5;

    const printWindow = {
      closed: false,
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);

    component.generateInvoice();
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({
      name: 'Owner',
      bussinessName: '<Acme Transport>',
      gstNo: 'GST123',
      bankName: 'Bank',
      acNo: '1234',
      ifsc: 'IFSC',
      address: 'Pune',
    });

    const updateRequest = httpTesting.expectOne(`${apiUrl}/api/treep/updateTreep/9`);
    expect(updateRequest.request.method).toBe('POST');
    updateRequest.flush('updated');

    const saveRequest = httpTesting.expectOne(`${apiUrl}/api/invoice/save`);
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body.billedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(saveRequest.request.body.customerName).toBe('Acme');
    expect(saveRequest.request.body.invoice).toContain('&lt;Acme Transport&gt;');
    expect(saveRequest.request.body.invoice).toContain('GST123');
    expect(saveRequest.request.body.invoice).toContain('Total Amount to Pay</th><td colspan="6">0</td>');
    expect(saveRequest.request.body.invoice).toContain('Total Due Amount</th><td colspan="6">220</td>');
    saveRequest.flush('Invoice saved');
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll`).flush([]);

    expect(component.generatingInvoice).toBe(false);
    expect(component.successMessage).toBe('Invoice saved');
    expect(printWindow.document.write).toHaveBeenCalledWith(saveRequest.request.body.invoice);
    expect(printWindow.print).toHaveBeenCalled();
  });

  it('shows an error and stops loading when the trips request fails', () => {
    const fixture = TestBed.createComponent(UnbilledTripsComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll`).flush(
      { message: 'Unavailable' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain('Unable to load unbilled trips');
    expect(fixture.nativeElement.textContent).toContain('No unbilled trips found');
  });
});

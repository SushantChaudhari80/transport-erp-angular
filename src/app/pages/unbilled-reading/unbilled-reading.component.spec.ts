import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Host } from '../../core/services/host';
import { UnbilledReadingComponent } from './unbilled-reading.component';

describe('UnbilledReadingComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnbilledReadingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  function loadPage(fixture: ReturnType<typeof TestBed.createComponent<UnbilledReadingComponent>>): void {
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll`).flush([
      {
        id: 5,
        orderName: 'Acme Earthworks',
        machineNumber: 'MH12AB1234',
        date: '2026-10-04',
        startReading: '100',
        endReading: '115',
        diesel: '10',
      },
      {
        id: 4,
        orderName: 'Beta Contractors',
        machineNumber: 'MH14CD5678',
        date: '2026-10-03',
        startReading: 50,
        endReading: 58,
        diesel: 6,
      },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 1, machine_number: 'MH12AB1234', company: 'TATA', v_type: 'Excavator' },
      { vehicle_id: 2, machine_number: 'MH14CD5678', company: 'Mahindra', v_type: 'Dumper' },
    ]);
    fixture.detectChanges();
  }

  it('loads readings and vehicles and calculates machine-hour totals', () => {
    const fixture = TestBed.createComponent(UnbilledReadingComponent);
    loadPage(fixture);

    const component = fixture.componentInstance;
    expect(component.readings.map((reading) => reading.id)).toEqual([5, 4]);
    expect(component.reportTotalHours).toBe(23);
    expect(component.totalDiesel).toBe(16);
    expect(component.calculateHours(component.readings[0])).toBe('15');
    expect(component.vehicles.map((vehicle) => vehicle.id)).toEqual([1, 2]);
    expect(component.errorMessage).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Acme Earthworks');
  });

  it('filters by vehicle and search and selects all visible readings', () => {
    const fixture = TestBed.createComponent(UnbilledReadingComponent);
    loadPage(fixture);
    const component = fixture.componentInstance;

    component.selectedVehicle = 'MH12AB1234';
    component.searchTerm = 'Acme';
    expect(component.filteredReadings.map((reading) => reading.id)).toEqual([5]);
    expect(component.reportTotalHours).toBe(15);

    component.toggleVisibleReadings();
    expect(component.selectedReadings.map((reading) => reading.id)).toEqual([5]);
  });

  it('allows selecting readings for only one named customer', () => {
    const fixture = TestBed.createComponent(UnbilledReadingComponent);
    loadPage(fixture);
    const component = fixture.componentInstance;
    component.readings = [
      { id: 4, orderName: 'Beta Contractors' },
      { id: 3, orderName: 'Acme Earthworks' },
      { id: 2, orderName: 'acme earthworks ' },
      { id: 1, orderName: '  ' },
    ];

    component.toggleReading(component.readings[1]);
    component.toggleVisibleReadings();

    expect(component.selectedReadings.map((reading) => reading.id)).toEqual([3, 2]);
    expect(component.selectedCustomerName).toBe('Acme Earthworks');
    expect(component.canSelectReading(component.readings[0])).toBe(false);
    expect(component.canSelectReading(component.readings[3])).toBe(false);
    expect(component.allVisibleSelected).toBe(true);
  });

  it('renders readings with nullable optional API fields instead of rejecting the response', () => {
    const fixture = TestBed.createComponent(UnbilledReadingComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll`).flush([
      {
        id: 31,
        orderName: 'Acme Earthworks',
        machineNumber: null,
        date: null,
        startReading: null,
        endReading: null,
        diesel: null,
      },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 1, machineNumber: null, machine_number: 'MH12AB1234' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.readings).toHaveLength(1);
    expect(fixture.componentInstance.errorMessage).toBe('');
    expect(fixture.componentInstance.calculateHours(fixture.componentInstance.readings[0])).toBe('N/A');
    expect(fixture.componentInstance.reportTotalHours).toBe(0);
    expect(fixture.componentInstance.totalDiesel).toBe(0);
    expect(fixture.componentInstance.vehicleNumber(fixture.componentInstance.vehicles[0]))
      .toBe('MH12AB1234');
    expect(fixture.nativeElement.textContent).toContain('Acme Earthworks');
    expect(fixture.nativeElement.textContent).toContain('31');
  });

  it('calculates invoice amounts from selected hours, hourly rate, GST, and advance', () => {
    const fixture = TestBed.createComponent(UnbilledReadingComponent);
    const component = fixture.componentInstance;
    component.readings = [
      { id: 1, startReading: 100, endReading: 110 },
      { id: 2, startReading: 30, endReading: 35 },
    ];
    component.selectedReadingIds = new Set(['1', '2']);
    component.hourlyRate = 80;
    component.gstPercent = 5;
    component.advancePayment = 100;

    expect(component.selectedHours).toBe(15);
    expect(component.invoiceSubtotal).toBe(1200);
    expect(component.invoiceTax).toBe(120);
    expect(component.invoiceTotal).toBe(1320);
    expect(component.invoiceDue).toBe(1220);
  });

  it('marks selected readings billed, saves the invoice, then opens and prints it', () => {
    const fixture = TestBed.createComponent(UnbilledReadingComponent);
    const component = fixture.componentInstance;
    component.readings = [
      { id: 9, orderName: 'Customer', machineNumber: 'MH12AB1234', date: '2026-10-04', startReading: 100, endReading: 112 },
    ];
    component.selectedReadingIds.add('9');
    component.hourlyRate = 100;
    component.advancePayment = 50;
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
      bussinessName: '<Machine Company>',
      gstNo: 'GST123',
      address: 'Pune',
      bankName: 'Bank',
      acNo: '1234',
      ifsc: 'IFSC',
    });

    const updateRequest = httpTesting.expectOne(`${apiUrl}/api/reading/updateReading/9`);
    expect(updateRequest.request.method).toBe('POST');
    updateRequest.flush('updated');

    const saveRequest = httpTesting.expectOne(`${apiUrl}/api/invoice/save`);
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body.customerName).toBe('Customer');
    expect(saveRequest.request.body.billedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(saveRequest.request.body.invoice).toContain('&lt;Machine Company&gt;');
    expect(saveRequest.request.body.invoice).toContain('GST123');
    expect(saveRequest.request.body.invoice).toContain('MH12AB1234');
    saveRequest.flush('Invoice saved');
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll`).flush([]);

    expect(component.generatingInvoice).toBe(false);
    expect(component.successMessage).toBe('Invoice saved');
    expect(printWindow.document.write).toHaveBeenCalledWith(saveRequest.request.body.invoice);
    expect(printWindow.print).toHaveBeenCalled();
  });

  it('reports reading API failures and ends the loading state', () => {
    const fixture = TestBed.createComponent(UnbilledReadingComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll`).flush(
      { message: 'Unavailable' },
      { status: 500, statusText: 'Server Error' },
    );
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.loadingReadings).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain('Unable to load unbilled readings');
  });
});

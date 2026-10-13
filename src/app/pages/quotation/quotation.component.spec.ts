import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Host } from '../../core/services/host';
import { QuotationComponent } from './quotation.component';

describe('QuotationComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function flushInitialData(fixture: ReturnType<typeof TestBed.createComponent<QuotationComponent>>): void {
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 3, machine_number: 'MH16DY3577' },
      { id: 4, machineNumber: 'MH16KK5632' },
      { id: 5, machine_number: null },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 8, customer_name: 'Acme Construction', address: 'Pune' },
      { id: 9, customer_name: ' acme construction ', address: 'Pune' },
      { id: 10, customer_name: 'Beta Transport', address: 'Mumbai' },
      { id: 11, customer_name: null },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({
      name: 'Business Owner',
      mobile: '9370637150',
      address: 'Ahmednagar',
      bussinessName: 'Acme Logistics',
      picture: 'iVBORw0KGgoAAAANSUhEUg==',
    });
    fixture.detectChanges();
  }

  it('loads unique customers and vehicles and renders the updated selections', () => {
    const fixture = TestBed.createComponent(QuotationComponent);
    flushInitialData(fixture);

    const component = fixture.componentInstance;
    expect(component.customers.map((customer) => customer.customer_name)).toEqual([
      'Acme Construction',
      'Beta Transport',
    ]);
    expect(component.vehicles.map((vehicle) => vehicle.id)).toEqual([3, 4]);
    expect(component.loadingCustomers).toBe(false);
    expect(component.loadingVehicles).toBe(false);
    expect(component.businessLogoUrl).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    expect(fixture.nativeElement.textContent).not.toContain('Loading business details…');
    expect(fixture.nativeElement.textContent).toContain('Acme Construction');
    expect(fixture.nativeElement.textContent).toContain('MH16DY3577');
    const logo = fixture.nativeElement.querySelector('.receipt-logo') as HTMLImageElement;
    expect(logo.src).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
  });

  it('preserves an image data URL supplied by the customer profile API', () => {
    const fixture = TestBed.createComponent(QuotationComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({
      picture: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.businessLogoUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect((fixture.nativeElement.querySelector('.receipt-logo') as HTMLImageElement).src)
      .toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  });

  it('derives customer address, preserves per-material values, and calculates the quotation total', () => {
    const fixture = TestBed.createComponent(QuotationComponent);
    flushInitialData(fixture);
    const component = fixture.componentInstance;

    component.selectedCustomer = 'Acme Construction';
    component.onCustomerChange();
    component.selectedMaterial = 'Sand';
    component.onMaterialChange();
    component.selectedUnit = 'KG';
    component.onUnitChange();
    component.quantity = 2.5;
    component.rate = 1200;
    component.onQuantityOrRateChange();

    expect(component.selectedCustomerAddress).toBe('Pune');
    expect(component.currentLineAmount).toBe(3000);
    expect(component.totalAmount).toBe(3000);
    expect(component.quotationLineCount).toBe(1);

    component.selectedMaterial = 'Bricks';
    component.onMaterialChange();
    expect(component.quantity).toBe(0);
    expect(component.selectedUnit).toBe('Brass');
    expect(component.rate).toBe(0);
    component.selectedMaterial = 'Sand';
    component.onMaterialChange();
    expect(component.quantity).toBe(2.5);
    expect(component.selectedUnit).toBe('KG');
    expect(component.rate).toBe(1200);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pune');
    expect(fixture.nativeElement.textContent).toContain('₹3000.00');
    expect(fixture.nativeElement.querySelector('.quotation-table tbody')?.textContent).toContain('KG');
    expect(fixture.nativeElement.querySelector('.line-list')?.textContent).toContain('KG');
  });

  it('prints only the quotation document', () => {
    const fixture = TestBed.createComponent(QuotationComponent);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.body.classList.contains('quotation-print-mode')).toBe(true);
    });

    fixture.componentInstance.printQuotation();

    expect(printSpy).toHaveBeenCalledOnce();
    expect(document.body.classList.contains('quotation-print-mode')).toBe(false);
    printSpy.mockRestore();
  });

  it('shows loading and retry states when customer or vehicle loading fails', () => {
    const fixture = TestBed.createComponent(QuotationComponent);
    fixture.detectChanges();

    const vehiclesRequest = httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`);
    const customersRequest = httpTesting.expectOne(`${apiUrl}/api/order/getAll`);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({});
    expect(fixture.componentInstance.loadingVehicles).toBe(true);
    expect(fixture.componentInstance.loadingCustomers).toBe(true);

    vehiclesRequest.flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    customersRequest.flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(fixture.componentInstance.loadingVehicles).toBe(false);
    expect(fixture.componentInstance.loadingCustomers).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Retry');
    expect(fixture.nativeElement.textContent).toContain('No customers available');
    expect(fixture.nativeElement.textContent).toContain('No vehicles available');

    fixture.componentInstance.retryCustomerLoad();
    fixture.componentInstance.retryVehicleLoad();
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Retry Customer' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { id: 1, machineNumber: 'MH12AB1234' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Retry Customer');
    expect(fixture.nativeElement.textContent).toContain('MH12AB1234');
  });

  it('clears profile loading and keeps the quotation usable when profile loading fails', () => {
    const fixture = TestBed.createComponent(QuotationComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([]);
    const profileRequest = httpTesting.expectOne(`${apiUrl}/api/customers/get`);

    expect(fixture.nativeElement.textContent).not.toContain('Loading business details');
    profileRequest.flush(
      { message: 'Unavailable' },
      { status: 503, statusText: 'Unavailable' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.loadingCustomerDetails).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Business address not provided');
    expect(fixture.nativeElement.textContent).not.toContain('Loading business details');
  });
});

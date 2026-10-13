import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Host } from '../../core/services/host';
import { TreepComponent } from './treep.component';

describe('TreepComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreepComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function flushInitialData(fixture: ReturnType<typeof TestBed.createComponent<TreepComponent>>): void {
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 3, machine_number: 'MH16DY3577' },
      { id: 4, machineNumber: 'MH16KK5632' },
      { vehicle_id: 5, machine_number: null, machineNumber: null },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 8, customer_name: 'Acme Construction' },
      { id: 9, customer_name: ' acme construction ' },
      { id: 10, customer_name: 'Beta Transport' },
      { id: 11, customer_name: null },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({
      name: 'Business Owner',
      mobile: '9370637150',
      address: 'Pune',
      bussinessName: 'Acme Logistics',
      picture: 'iVBORw0KGgoAAAANSUhEUg==',
    });
    fixture.detectChanges();
  }

  it('loads and normalizes unique customers and vehicles without stale OnPush values', () => {
    const fixture = TestBed.createComponent(TreepComponent);
    flushInitialData(fixture);

    const component = fixture.componentInstance;
    expect(component.customers.map((customer) => customer.customer_name)).toEqual([
      'Acme Construction',
      'Beta Transport',
    ]);
    expect(component.vehicles.map((vehicle) => vehicle.machine_number)).toEqual([
      'MH16DY3577',
      'MH16KK5632',
    ]);
    expect(component.loadingCustomers).toBe(false);
    expect(component.loadingVehicles).toBe(false);
    expect(component.businessLogoUrl).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    expect(fixture.nativeElement.textContent).not.toContain('Loading business details…');
    expect(fixture.nativeElement.textContent).toContain('Acme Construction');
    expect(fixture.nativeElement.textContent).toContain('MH16DY3577');
    expect((fixture.nativeElement.querySelector('.receipt-logo') as HTMLImageElement).src)
      .toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
  });

  it('keeps a complete image data URL from the customer profile API', () => {
    const fixture = TestBed.createComponent(TreepComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({
      picture: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.businessLogoUrl)
      .toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect((fixture.nativeElement.querySelector('.receipt-logo') as HTMLImageElement).src)
      .toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  });

  it('shows loading and empty/error states for failed master-data requests', () => {
    const fixture = TestBed.createComponent(TreepComponent);
    fixture.detectChanges();

    const vehicleRequest = httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`);
    const customerRequest = httpTesting.expectOne(`${apiUrl}/api/order/getAll`);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({});
    expect(fixture.componentInstance.loadingVehicles).toBe(true);
    expect(fixture.componentInstance.loadingCustomers).toBe(true);

    vehicleRequest.flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    customerRequest.flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.loadingVehicles).toBe(false);
    expect(fixture.componentInstance.loadingCustomers).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No customers available');
    expect(fixture.nativeElement.textContent).toContain('No vehicles available');
    expect(fixture.nativeElement.textContent).toContain('Retry');
  });

  it('clears profile loading and keeps the receipt usable when profile loading fails', () => {
    const fixture = TestBed.createComponent(TreepComponent);
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

  it('validates and saves the selected trip with the existing payload contract', () => {
    const fixture = TestBed.createComponent(TreepComponent);
    flushInitialData(fixture);
    const component = fixture.componentInstance;
    component.selectedCustomerId = 8;
    component.selectedVehicleId = 3;
    component.selectedMaterial = 'Soil';
    component.soilBrass = 4;
    component.soilRate = 1200;

    expect(component.canSubmit).toBe(true);
    expect(component.totalAmount).toBe(4800);
    component.saveTreep();

    const request = httpTesting.expectOne(`${apiUrl}/api/treep/add`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      selectedVehicle: 'MH16DY3577',
      customerName: 'Acme Construction',
      soilBrass: 4,
      soilRate: 1200,
      item: 'Soil',
      submittedBy: 'Admin',
      isBilled: false,
    });
    request.flush('Trip saved');
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.successMessage).toBe('Trip saved');
  });

  it('rejects invalid values and prevents submission while master data is loading', () => {
    const fixture = TestBed.createComponent(TreepComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 1, machine_number: 'MH12AB1234' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/order/getAll`).flush([
      { id: 1, customer_name: 'Acme' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({});

    const component = fixture.componentInstance;
    component.selectedCustomerId = 1;
    component.selectedVehicleId = 1;
    component.selectedMaterial = 'Sand';
    component.soilBrass = Number.NaN;
    component.soilRate = 100;
    component.saveTreep();

    expect(component.errorMessage).toContain('valid quantity');
    httpTesting.expectNone(`${apiUrl}/api/treep/add`);
  });
});

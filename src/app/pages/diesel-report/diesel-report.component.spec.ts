import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Host } from '../../core/services/host';
import { DieselReportComponent } from './diesel-report.component';

describe('DieselReportComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'diesel', component: DieselReportComponent }]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads vehicles and diesel records and calculates the report totals', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/diesel', DieselReportComponent);

    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 1, machine_number: 'MH12AB1234', company: 'TATA', v_type: 'Excavator' },
    ]);
    httpTesting.expectOne(`${apiUrl}/vehicle/getDisel`).flush([
      {
        id: 1,
        date: '2026-10-01',
        orderName: 'Deepika Kale',
        machineNumber: 'MH12AB1234',
        petrolPump: 'Shell India',
        fuelRate: '100.5',
        diesel: '25',
      },
      {
        id: 2,
        orderName: null,
        machineNumber: 'MH12AB1234',
        fuelRate: 99,
        diesel: 10,
      },
      {
        id: 3,
        machineNumber: 'MH14CD5678',
        fuelRate: 'bad',
        diesel: 'bad',
      },
    ]);
    harness.detectChanges();

    expect(component.records.map((record) => record.id)).toEqual([3, 2, 1]);
    expect(component.totalVehicles).toBe(2);
    expect(component.totalFuel).toBe(35);
    expect(component.totalAmount).toBe(3502.5);
    expect(component.vehicles.map((vehicle) => vehicle.id)).toEqual([1]);
    expect(component.errorMessage).toBe('');
    expect(harness.routeNativeElement?.textContent).toContain('Diesel Consumption Report');
    expect(harness.routeNativeElement?.textContent).toContain('MH12AB1234');
    expect(harness.routeNativeElement?.textContent).toContain('Customer name');
    expect(harness.routeNativeElement?.textContent).toContain('Deepika Kale');
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('—');
    component.searchTerm = 'Deepika Kale';
    expect(component.filteredRecords.map((record) => record.id)).toEqual([1]);
  });

  it('posts a diesel entry with the API payload then refreshes records', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/diesel', DieselReportComponent);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 7, machine_number: 'MH16XY1234', company: 'TATA', v_type: 'Excavator' },
    ]);
    httpTesting.expectOne(`${apiUrl}/vehicle/getDisel`).flush([]);

    component.openAddModal();
    component.form = {
      vehicleId: '7',
      fuelInLtr: 20,
      petrolPump: 'Indian Oil Corporation (IOCL)',
      rate: 101.25,
    };
    component.submitDiesel();

    const request = httpTesting.expectOne(`${apiUrl}/api/diesel/addDiesel`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      vehicleNumber: 'MH16XY1234',
      fuelInLtr: 20,
      petrolPump: 'Indian Oil Corporation (IOCL)',
      rate: 101.25,
    });
    request.flush('Diesel added successfully');
    harness.detectChanges();

    expect(component.showAddModal).toBe(false);
    expect(component.successMessage).toBe('Diesel added successfully');
    httpTesting.expectOne(`${apiUrl}/vehicle/getDisel`).flush([
      { id: 1, machineNumber: 'MH16XY1234', fuelRate: 101.25, diesel: 20 },
    ]);
  });

  it('renders records with nullable API fields instead of rejecting the whole response', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/diesel', DieselReportComponent);

    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 11, machine_number: null, machineNumber: null },
    ]);
    httpTesting.expectOne(`${apiUrl}/vehicle/getDisel`).flush([
      {
        id: 27,
        date: null,
        orderName: null,
        machineNumber: null,
        petrolPump: null,
        fuelRate: null,
        diesel: null,
      },
    ]);
    harness.detectChanges();

    expect(component.records).toHaveLength(1);
    expect(component.errorMessage).toBe('');
    expect(component.totalFuel).toBe(0);
    expect(component.totalAmount).toBe(0);
    expect(component.totalVehicles).toBe(0);
    expect(harness.routeNativeElement?.textContent).toContain('#27');
    expect(harness.routeNativeElement?.querySelector('tbody tr')).not.toBeNull();
    expect(component.vehicles).toHaveLength(1);
  });

  it('does not call the add endpoint when the fuel details are invalid', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/diesel', DieselReportComponent);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 7, machine_number: 'MH16XY1234', company: 'TATA', v_type: 'Excavator' },
    ]);
    httpTesting.expectOne(`${apiUrl}/vehicle/getDisel`).flush([]);

    component.openAddModal();
    component.form = {
      vehicleId: '7',
      fuelInLtr: 0,
      petrolPump: 'Shell India',
      rate: 100,
    };
    component.submitDiesel();

    expect(component.modalError).toBe('Enter fuel in litres greater than zero.');
    expect(component.saving).toBe(false);
    httpTesting.expectNone(`${apiUrl}/api/diesel/addDiesel`);
    harness.detectChanges();
  });
});

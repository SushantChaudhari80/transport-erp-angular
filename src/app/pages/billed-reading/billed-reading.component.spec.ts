import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Host } from '../../core/services/host';
import { BilledReadingComponent } from './billed-reading.component';

describe('BilledReadingComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BilledReadingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function loadPage(fixture: ReturnType<typeof TestBed.createComponent<BilledReadingComponent>>): void {
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll/billed`).flush([
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

  it('loads billed readings and vehicles and calculates report totals', () => {
    const fixture = TestBed.createComponent(BilledReadingComponent);
    loadPage(fixture);

    const component = fixture.componentInstance;
    expect(component.readings.map((reading) => reading.id)).toEqual([5, 4]);
    expect(component.totalHours).toBe(23);
    expect(component.totalDiesel).toBe(16);
    expect(component.calculateHours(component.readings[0])).toBe('15');
    expect(component.vehicles.map((vehicle) => vehicle.id)).toEqual([1, 2]);
    expect(component.errorMessage).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Acme Earthworks');
  });

  it('filters billed readings by machine and search term and updates totals', () => {
    const fixture = TestBed.createComponent(BilledReadingComponent);
    loadPage(fixture);
    const component = fixture.componentInstance;

    component.selectedVehicle = 'MH12AB1234';
    component.searchTerm = 'Acme';
    expect(component.filteredReadings.map((reading) => reading.id)).toEqual([5]);
    expect(component.totalHours).toBe(15);
    expect(component.totalDiesel).toBe(10);
  });

  it('keeps billed readings when optional API fields are null', () => {
    const fixture = TestBed.createComponent(BilledReadingComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll/billed`).flush([
      {
        id: 27,
        orderName: 'Acme Earthworks',
        machineNumber: null,
        date: null,
        startReading: null,
        endReading: null,
        diesel: null,
      },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.readings).toHaveLength(1);
    expect(fixture.componentInstance.errorMessage).toBe('');
    expect(fixture.componentInstance.totalHours).toBe(0);
    expect(fixture.componentInstance.totalDiesel).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Acme Earthworks');
  });

  it('shows a useful error when the billed readings API fails', () => {
    const fixture = TestBed.createComponent(BilledReadingComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll/billed`).flush(
      { message: 'Unavailable' },
      { status: 500, statusText: 'Server Error' },
    );
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.loadingReadings).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain('Unable to load billed readings');
    expect(fixture.nativeElement.textContent).toContain('No billed machine readings found');
  });
});

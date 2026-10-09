import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Host } from '../../core/services/host';
import { BilledTripsComponent } from './billed-trips.component';

describe('BilledTripsComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BilledTripsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads billed trips and calculates visible report totals', () => {
    const fixture = TestBed.createComponent(BilledTripsComponent);
    fixture.detectChanges();

    httpTesting.expectOne(`${apiUrl}/api/treep/getAll/billed`).flush([
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

    expect(fixture.componentInstance.trips.map((trip) => trip.id)).toEqual([5, 4]);
    expect(fixture.componentInstance.totalPayment).toBe(3000);
    expect(fixture.componentInstance.totalAdvance).toBe(700);
    expect(fixture.componentInstance.totalDiesel).toBe(15);
    expect(fixture.componentInstance.duePayment).toBe(2300);
    expect(fixture.nativeElement.textContent).toContain('Acme Transport');
  });

  it('filters the trips and recalculates sums for the visible results', () => {
    const fixture = TestBed.createComponent(BilledTripsComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll/billed`).flush([
      { id: 2, customerName: 'Acme Transport', totalPayment: 900, advance: 300, diesel: 4 },
      { id: 1, customerName: 'Beta Hauling', totalPayment: 500, advance: 100, diesel: 2 },
    ]);
    fixture.detectChanges();

    fixture.componentInstance.searchTerm = 'Acme';

    expect(fixture.componentInstance.filteredTrips).toHaveLength(1);
    expect(fixture.componentInstance.totalPayment).toBe(900);
    expect(fixture.componentInstance.totalAdvance).toBe(300);
    expect(fixture.componentInstance.totalDiesel).toBe(4);
  });

  it('renders API records containing nullable fields instead of rejecting the entire response', () => {
    const fixture = TestBed.createComponent(BilledTripsComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll/billed`).flush([
      {
        id: 27,
        createDate: '2026-10-04',
        item: 'Sand',
        customerName: 'Acme Transport',
        selectedVehicle: 'MH12AB1234',
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
  });

  it('shows an error and stops loading when the billed trip request fails', () => {
    const fixture = TestBed.createComponent(BilledTripsComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/treep/getAll/billed`).flush(
      { message: 'Unavailable' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain('Unable to load billed trips');
    expect(fixture.nativeElement.textContent).toContain('No billed trips found.');
  });
});

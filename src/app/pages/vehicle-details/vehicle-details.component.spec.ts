import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Host } from '../../core/services/host';
import { VehicleDetailsComponent } from './vehicle-details.component';

describe('VehicleDetailsComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'vehicle-details', component: VehicleDetailsComponent },
        ]),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should load drivers and readings for the selected machine', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/vehicle-details?vType=Excavator&driverName=MH16BH2818',
      VehicleDetailsComponent,
    );

    httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/api/driver/getByMachineNumber` &&
        request.params.get('i') === 'MH16BH2818',
    ).flush([{ id: 3, driverName: 'Sushant Chaudhari' }]);
    httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/vehicle/getRecords` &&
        request.params.get('machinN') === 'MH16BH2818',
    ).flush([
      {
        id: 17,
        date: '2026-10-01',
        startReading: 120,
        endReading: 130,
        diesel: 5,
        driverName: 'Sushant Chaudhari',
      },
    ]);
    harness.detectChanges();

    expect(page.machineNumber).toBe('MH16BH2818');
    expect(harness.routeNativeElement?.textContent).toContain('Sushant Chaudhari');
    expect(harness.routeNativeElement?.textContent).toContain('2026-10-01');
    expect(harness.routeNativeElement?.textContent).toContain('10');
  }, 15000);

  it('should open and update a reading when its table row is selected', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/vehicle-details?vType=Excavator&driverName=MH16BH2818',
      VehicleDetailsComponent,
    );

    httpTesting.expectOne(`${apiUrl}/api/driver/getByMachineNumber?i=MH16BH2818`)
      .flush([]);
    httpTesting.expectOne(`${apiUrl}/vehicle/getRecords?machinN=MH16BH2818`).flush([
      { id: 17, date: '2026-10-01', startReading: 120, endReading: 130 },
    ]);
    harness.detectChanges();

    const readingRow = harness.routeNativeElement?.querySelector('.reading-row') as HTMLElement;
    readingRow.click();
    harness.detectChanges();

    httpTesting.expectOne(`${apiUrl}/admin/reading/getById?id=17`).flush({
      startReading: 'c3RhcnQ=',
      endReading: 'ZW5k',
      disel: 'ZGllc2Vs',
      startReadingCount: '14936.2',
      endReadingCount: '14944.5',
    });
    harness.detectChanges();

    expect(page.showReadingModal).toBe(true);
    expect(page.loadingReadingDetails).toBe(false);
    expect(harness.routeNativeElement?.querySelector('[role="dialog"]')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain('Loading reading…');
    expect(page.readingForm.startReading).toBe('14936.2');
    expect(page.readingForm.endReading).toBe('14944.5');
    expect(page.toImageUrl(page.readingDetails?.startReading)).toBe('data:image/jpeg;base64,c3RhcnQ=');

    page.readingForm = { startReading: '121', endReading: '132', diesel: '6' };
    page.saveReading();
    const updateRequest = httpTesting.expectOne(`${apiUrl}/admin/reading`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toBeInstanceOf(FormData);
    expect((updateRequest.request.body as FormData).get('id')).toBe('17');
    expect((updateRequest.request.body as FormData).get('startReading')).toBe('121');
    updateRequest.flush('Reading updated successfully!');
    harness.detectChanges();

    expect(page.showReadingModal).toBe(false);
    httpTesting.expectOne(`${apiUrl}/vehicle/getRecords?machinN=MH16BH2818`).flush([]);
  });

  it('should omit the machine readings table for Dumper vehicles', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/vehicle-details?vType=Dumper&driverName=MH16DY3577',
      VehicleDetailsComponent,
    );
    httpTesting.expectOne(`${apiUrl}/api/driver/getByMachineNumber?i=MH16DY3577`).flush([]);
    harness.detectChanges();

    expect(page.showReadingsTable).toBe(false);
    expect(harness.routeNativeElement?.textContent).toContain(
      'Machine readings are not displayed for Dumper vehicles.',
    );
    httpTesting.expectNone(`${apiUrl}/vehicle/getRecords?machinN=MH16DY3577`);
  });

  it('should close the assign-driver modal as soon as the assignment succeeds', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/vehicle-details?vType=Excavator&driverName=MH16BH2818',
      VehicleDetailsComponent,
    );
    httpTesting.expectOne(`${apiUrl}/api/driver/getByMachineNumber?i=MH16BH2818`)
      .flush([]);
    httpTesting.expectOne(`${apiUrl}/vehicle/getRecords?machinN=MH16BH2818`).flush([]);
    harness.detectChanges();

    page.openAssignDriverModal();
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush([
      { id: 4, driverName: 'Omkar Darekar' },
    ]);
    page.selectedDriverId = '4';
    page.assignDriver();

    httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/api/driver/assignDriver` &&
        request.params.get('mNumber') === 'MH16BH2818' &&
        request.params.get('DriverId') === '4',
    ).flush('Driver assigned successfully!');
    harness.detectChanges();

    expect(page.showAssignDriverModal).toBe(false);
    expect(harness.routeNativeElement?.querySelector('[aria-labelledby="assignDriverTitle"]'))
      .toBeNull();
    httpTesting.expectOne(`${apiUrl}/api/driver/getByMachineNumber?i=MH16BH2818`)
      .flush([{ id: 4, driverName: 'Omkar Darekar' }]);
    harness.detectChanges();
  });
});

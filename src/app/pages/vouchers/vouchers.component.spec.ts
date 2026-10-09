import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Host } from '../../core/services/host';
import { VouchersComponent } from './vouchers.component';

describe('VouchersComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VouchersComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function loadInitialData(): VouchersComponent {
    const fixture = TestBed.createComponent(VouchersComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/voucher/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 4, machine_number: 'MH12AB1234', company: 'TATA', v_type: 'Excavator' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush([
      { id: 9, driverName: 'Sushant Chaudhari' },
    ]);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('loads vehicles, drivers, and vouchers and filters voucher rows', () => {
    const fixture = TestBed.createComponent(VouchersComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/voucher/getAll`).flush([
      { id: 2, machineNumber: 'MH12AB1234', driverName: 'Sushant Chaudhari', amount: 200 },
      { id: 1, machineNumber: 'MH14XY5555', driverName: 'Omkar Darekar', amount: 100 },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      { vehicle_id: 4, machine_number: 'MH12AB1234', company: 'TATA', v_type: 'Excavator' },
    ]);
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush([
      { id: 9, driverName: 'Sushant Chaudhari' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.vouchers.map((voucher) => voucher.id)).toEqual([2, 1]);
    expect(fixture.componentInstance.vehicles.map((vehicle) => vehicle.id)).toEqual([4]);
    expect(fixture.componentInstance.errorMessage).toBe('');
    fixture.componentInstance.searchTerm = 'Omkar';
    expect(fixture.componentInstance.filteredVouchers.map((voucher) => voucher.id)).toEqual([1]);
  });

  it('posts a voucher and refreshes the voucher list', () => {
    const component = loadInitialData();
    component.openAddModal();
    component.form = {
      vehicleId: '4',
      driverId: '9',
      amount: 1500,
      createDate: '2026-10-04',
      comment: 'Vehicle repair',
    };
    component.submitVoucher();

    const addRequest = httpTesting.expectOne(`${apiUrl}/api/voucher/add`);
    expect(addRequest.request.method).toBe('POST');
    expect(component.vehicles[0].id).toBe(4);
    expect(addRequest.request.body).toEqual({
      machineNumber: 'MH12AB1234',
      driverName: 'Sushant Chaudhari',
      amount: 1500,
      createDate: '2026-10-04',
      comment: 'Vehicle repair',
    });
    addRequest.flush('Voucher added');

    expect(component.showAddModal).toBe(false);
    expect(component.successMessage).toBe('Voucher added');
    httpTesting.expectOne(`${apiUrl}/api/voucher/getAll`).flush([
      { id: 1, machineNumber: 'MH12AB1234', driverName: 'Sushant Chaudhari', amount: 1500 },
    ]);
  });

  it('validates voucher amount before sending a request', () => {
    const component = loadInitialData();
    component.form = {
      vehicleId: '4',
      driverId: '9',
      amount: 0,
      createDate: '2026-10-04',
      comment: 'Test',
    };
    component.submitVoucher();

    expect(component.modalError).toBe('Enter an amount greater than zero.');
    httpTesting.expectNone(`${apiUrl}/api/voucher/add`);
  });

  it('deletes a confirmed voucher and reloads the list', () => {
    const component = loadInitialData();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteVoucher({ id: 6, machineNumber: 'MH12AB1234' });

    const deleteRequest = httpTesting.expectOne(
      (request) =>
        request.url === `${apiUrl}/api/voucher/delete/` &&
        request.params.get('id') === '6',
    );
    expect(deleteRequest.request.method).toBe('GET');
    deleteRequest.flush('Voucher deleted');
    expect(confirmSpy).toHaveBeenCalled();
    expect(component.successMessage).toBe('Voucher deleted');
    httpTesting.expectOne(`${apiUrl}/api/voucher/getAll`).flush([]);
    confirmSpy.mockRestore();
  });
});

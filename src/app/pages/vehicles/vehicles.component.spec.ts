import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Host } from '../../core/services/host';
import { VehiclesComponent } from './vehicles.component';

describe('VehiclesComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let fixture: ComponentFixture<VehiclesComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehiclesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehiclesComponent);
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should display the vehicles after the request completes', () => {
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
  });

  it('should stop loading and display an error if the request fails', () => {
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush(
      { message: 'Server error' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to load vehicles. Please try again.',
    );
  });

  it('should separate the two driver names in the vehicle list and details', () => {
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      {
        vehicle_id: 1,
        machine_number: 'MH16BH2818',
        company: 'TATA',
        v_type: 'Excavator',
        driver_names: 'Sushant chaudhari Omkar darekar',
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.driver-name').textContent.trim()).toBe(
      'Sushant chaudhari, Omkar darekar',
    );
    expect(fixture.componentInstance.formatDriverNames('Sushant chaudhari,Omkar darekar'))
      .toBe('Sushant chaudhari, Omkar darekar');
  });

  it('should show machinery icons instead of Excavator and Dumper text', () => {
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([
      {
        vehicle_id: 1,
        machine_number: 'MH16BH2818',
        company: 'TATA',
        v_type: 'Excavator',
        driver_names: 'Sushant Chaudhari',
      },
      {
        vehicle_id: 2,
        machine_number: 'MH16DY3577',
        company: 'TATA',
        v_type: 'Dumper',
        driver_names: 'Prashant Chaudhari',
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Excavator"] svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Dumper"] svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.vehicle-type')).toBeNull();
  });

  it('should add a vehicle with the API payload and refresh the vehicle list', () => {
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    fixture.componentInstance.openAddVehicleModal();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();

    fixture.componentInstance.addVehicleForm = {
      machine_number: ' MH16BH2818 ',
      company: ' TATA ',
      v_type: 'Excavator',
    };
    fixture.componentInstance.submitAddVehicle();

    const addRequest = httpTesting.expectOne(`${apiUrl}/api/vehicles/add`);
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({
      machineNumber: 'MH16BH2818',
      company: 'TATA',
      v_type: 'Excavator',
    });
    addRequest.flush('Created vehicle #12');
    fixture.detectChanges();

    expect(fixture.componentInstance.showAddVehicleModal).toBe(false);
    expect(fixture.componentInstance.successMessage).toBe('Vehicle added successfully!');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
  });

  it('should show an error and not call the API for invalid vehicle details', () => {
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    fixture.componentInstance.openAddVehicleModal();
    fixture.componentInstance.addVehicleForm.machine_number = ' ';
    fixture.componentInstance.addVehicleForm.company = 'TATA';

    fixture.componentInstance.submitAddVehicle();

    expect(fixture.componentInstance.addVehicleError).toContain('Enter the machine number');
    expect(fixture.componentInstance.addingVehicle).toBe(false);
    httpTesting.expectNone(`${apiUrl}/api/vehicles/add`);
  });
});

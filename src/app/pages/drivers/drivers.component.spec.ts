import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Host } from '../../core/services/host';
import { DriversComponent } from './drivers.component';

describe('DriversComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let fixture: ComponentFixture<DriversComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriversComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DriversComponent);
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should display the drivers after the request completes', () => {
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
  });

  it('should stop loading and display an error if the request fails', () => {
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush(
      { message: 'Server error' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to load drivers. Please try again.',
    );
  });

  it('should add a driver using the provided payload and refresh the list', () => {
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush([]);
    fixture.componentInstance.openAddDriverModal();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();

    fixture.componentInstance.addDriverForm = {
      driverName: ' Sushant Chaudhari ',
      driverMobile: '9876543210',
      driverAddress: ' Pune ',
      driverAadhar: '123456789012',
      driverLiecense: 'MH1420200012345',
      driverSalary: '25000',
    };
    fixture.componentInstance.submitAddDriver();

    const addRequest = httpTesting.expectOne(`${apiUrl}/api/driver/add`);
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({
      driverName: 'Sushant Chaudhari',
      driverMobile: '9876543210',
      driverAddress: 'Pune',
      driverAadhar: '123456789012',
      driverLiecense: 'MH1420200012345',
      driverSalary: '25000',
    });
    addRequest.flush('Driver created: 12');
    fixture.detectChanges();

    expect(fixture.componentInstance.showAddDriverModal).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.componentInstance.successMessage).toBe('Driver added successfully!');
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush([]);
  });

  it('should validate mobile and Aadhaar numbers before submitting', () => {
    httpTesting.expectOne(`${apiUrl}/api/driver/getAll`).flush([]);
    fixture.componentInstance.openAddDriverModal();
    fixture.componentInstance.addDriverForm = {
      driverName: 'Test Driver',
      driverMobile: '1234',
      driverAddress: 'Pune',
      driverAadhar: '123',
      driverLiecense: 'MH123',
      driverSalary: '25000',
    };

    fixture.componentInstance.submitAddDriver();

    expect(fixture.componentInstance.addDriverError).toContain('Mobile must be 10 digits');
    expect(fixture.componentInstance.addingDriver).toBe(false);
    httpTesting.expectNone(`${apiUrl}/api/driver/add`);
  });
});

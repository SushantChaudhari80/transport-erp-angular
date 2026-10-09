import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Host } from '../../core/services/host';
import { Router } from '@angular/router';

interface Driver {
  id: number;
  driverName: string;
  driverMobile: string;
  driverAddress: string;
  driverAadhar: string;
  driverLiencense: string;
  machineNumber: string;
  driverSalary: number;
}

interface AddDriverForm {
  driverName: string;
  driverMobile: string;
  driverAddress: string;
  driverAadhar: string;
  driverLiecense: string;
  driverSalary: string | number;
}

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './drivers.component.html',
  styleUrl: './drivers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriversComponent implements OnInit {

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  drivers: Driver[] = [];

  loading = false;
  errorMessage = '';
  successMessage = '';
  showAddDriverModal = false;
  addingDriver = false;
  addDriverError = '';
  addDriverForm: AddDriverForm = this.emptyAddDriverForm();

  // Filters
  selectedStatus = '';
  searchText = '';

  // Modal
  selectedDriver: Driver | null = null;
  showModal = false;

  readonly statusOptions = [
    'available',
    'on-duty',
    'off-duty',
  ];

  ngOnInit(): void {
    this.loadDrivers();
  }

  openAddDriverModal(): void {
    this.addDriverForm = this.emptyAddDriverForm();
    this.addDriverError = '';
    this.showAddDriverModal = true;
  }

  closeAddDriverModal(): void {
    if (this.addingDriver) {
      return;
    }

    this.showAddDriverModal = false;
    this.addDriverError = '';
  }

  submitAddDriver(): void {
    if (this.addingDriver) {
      return;
    }

    const driverName = this.addDriverForm.driverName.trim();
    const driverMobile = this.addDriverForm.driverMobile.trim();
    const driverAddress = this.addDriverForm.driverAddress.trim();
    const driverAadhar = this.addDriverForm.driverAadhar.trim();
    const driverLiecense = this.addDriverForm.driverLiecense.trim();
    const salaryValue = String(this.addDriverForm.driverSalary ?? '').trim();
    const salary = Number(salaryValue);

    if (
      !driverName ||
      !driverAddress ||
      !driverLiecense ||
      !/^\d{10}$/.test(driverMobile) ||
      !/^\d{12}$/.test(driverAadhar) ||
      !salaryValue ||
      !Number.isFinite(salary) ||
      salary < 0
    ) {
      this.addDriverError =
        'Enter all driver details. Mobile must be 10 digits, Aadhaar must be 12 digits, and salary must be a non-negative number.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.addingDriver = true;
    this.addDriverError = '';
    this.http
      .post(
        `${this.apiUrl}/api/driver/add`,
        {
          driverName,
          driverMobile,
          driverAddress,
          driverAadhar,
          driverLiecense,
          driverSalary: salaryValue,
        },
        { responseType: 'text' },
      )
      .subscribe({
        next: (response) => {
          console.log('Add driver API response:', response);
          this.addingDriver = false;
          this.showAddDriverModal = false;
          this.successMessage = 'Driver added successfully!';
          this.loadDrivers();
          this.changeDetectorRef.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error adding driver:', error);
          this.addingDriver = false;
          this.addDriverError = 'Error adding driver. Please try again.';
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  private emptyAddDriverForm(): AddDriverForm {
    return {
      driverName: '',
      driverMobile: '',
      driverAddress: '',
      driverAadhar: '',
      driverLiecense: '',
      driverSalary: '',
    };
  }

  // ==========================================================
  // Load Drivers
  // ==========================================================

  loadDrivers(): void {

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<unknown>(
        `${this.apiUrl}/api/driver/getAll`
      )
      .subscribe({

        next: (response) => {
          if (!Array.isArray(response)) {
            console.error('Unexpected response from drivers API:', response);
            this.loading = false;
            this.errorMessage = 'The drivers service returned an unexpected response.';
            this.changeDetectorRef.markForCheck();
            return;
          }

          this.drivers = response;

          this.loading = false;
          this.changeDetectorRef.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching Driver data:',
            error
          );

          this.loading = false;

          this.errorMessage =
            'Unable to load drivers. Please try again.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  // ==========================================================
  // Filtering
  // ==========================================================

  get filteredDrivers(): Driver[] {

    const search = this.searchText
      .trim()
      .toLowerCase();

    return this.drivers.filter(driver => {

      if (!search) {
        return true;
      }

      return (
        driver.driverName
          ?.toLowerCase()
          .includes(search) ||

        driver.driverMobile
          ?.toLowerCase()
          .includes(search) ||

        driver.driverAddress
          ?.toLowerCase()
          .includes(search) ||

        driver.machineNumber
          ?.toLowerCase()
          .includes(search)
      );
    });
  }

  applyFilters(): void {
    /*
     * The supplied backend response does not contain a driver
     * status field, so status filtering is not applied here.
     *
     * Search filtering is handled by filteredDrivers.
     */
  }

  clearFilters(): void {

    this.selectedStatus = '';
    this.searchText = '';
  }

  // ==========================================================
  // Driver Details
  // ==========================================================

  openDriverDetails(driver: Driver): void {

    this.selectedDriver = driver;
    this.showModal = true;
  }

  closeModal(): void {

    this.showModal = false;
    this.selectedDriver = null;
  }

  // ==========================================================
  // Driver Payment
  // ==========================================================

  openDriverPayment(driver: Driver): void {

    void this.router.navigate(
      ['/driver-payment'],
      {
        queryParams: {
          driverId: driver.id,
          driverName: driver.driverName,
        },
      }
    );
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  formatSalary(salary: number | null | undefined): string {

    if (
      salary === null ||
      salary === undefined ||
      salary === 0
    ) {
      return '-';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(salary);
  }

  trackByDriverId(
    index: number,
    driver: Driver
  ): number {

    return driver.id;
  }
}
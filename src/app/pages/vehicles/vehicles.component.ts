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
import { Router } from '@angular/router';
import { Host } from '../../core/services/host';

interface Vehicle {
  vehicle_id: number;
  machine_number: string;
  company: string;
  v_type: string;
  driver_names: string;
}

interface AddVehicleForm {
  machine_number: string;
  company: string;
  v_type: string;
}

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehiclesComponent implements OnInit {

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  vehicles: Vehicle[] = [];

  loading = false;
  errorMessage = '';
  successMessage = '';
  showAddVehicleModal = false;
  addingVehicle = false;
  addVehicleError = '';
  addVehicleForm: AddVehicleForm = this.emptyAddVehicleForm();
  readonly vehicleTypes = ['Excavator', 'Dumper'];

  // Filters
  selectedStatus = '';
  searchText = '';

  // Selected vehicle
  selectedVehicle: Vehicle | null = null;
  showModal = false;

  readonly statusOptions = [
    'active',
    'maintenance',
    'unavailable',
  ];

  ngOnInit(): void {
    this.loadVehicles();
  }

  openAddVehicleModal(): void {
    this.addVehicleForm = this.emptyAddVehicleForm();
    this.addVehicleError = '';
    this.showAddVehicleModal = true;
  }

  closeAddVehicleModal(): void {
    if (this.addingVehicle) {
      return;
    }

    this.showAddVehicleModal = false;
    this.addVehicleError = '';
  }

  submitAddVehicle(): void {
    if (this.addingVehicle) {
      return;
    }

    const machineNumber = this.addVehicleForm.machine_number.trim();
    const company = this.addVehicleForm.company.trim();
    if (!machineNumber || !company || !this.vehicleTypes.includes(this.addVehicleForm.v_type)) {
      this.addVehicleError = 'Enter the machine number and company, and select a vehicle type.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.addingVehicle = true;
    this.addVehicleError = '';
    this.http
      .post(
        `${this.apiUrl}/api/vehicles/add`,
        {
          machineNumber,
          company,
          v_type: this.addVehicleForm.v_type,
        },
        { responseType: 'text' },
      )
      .subscribe({
        next: (response) => {
          console.log('Add vehicle API response:', response);
          this.addingVehicle = false;
          this.showAddVehicleModal = false;
          this.successMessage = 'Vehicle added successfully!';
          this.loadVehicles();
          this.changeDetectorRef.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error adding vehicle:', error);
          this.addingVehicle = false;
          this.addVehicleError = 'Error adding vehicle. Please try again.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  private emptyAddVehicleForm(): AddVehicleForm {
    return {
      machine_number: '',
      company: '',
      v_type: 'Excavator',
    };
  }

  // ==========================================================
  // Load Vehicles
  // ==========================================================

  loadVehicles(): void {

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<unknown>(
        `${this.apiUrl}/api/vehicles/getAll`
      )
      .subscribe({

        next: (response) => {
          if (!Array.isArray(response)) {
            console.error('Unexpected response from vehicles API:', response);
            this.loading = false;
            this.errorMessage = 'The vehicles service returned an unexpected response.';
            this.changeDetectorRef.markForCheck();
            return;
          }

          this.vehicles = response;

          this.loading = false;
          this.changeDetectorRef.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error fetching vehicle data:',
            error
          );

          this.loading = false;

          this.errorMessage =
            'Unable to load vehicles. Please try again.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  // ==========================================================
  // Filtered Vehicles
  // ==========================================================

  get filteredVehicles(): Vehicle[] {

    const search = this.searchText
      .trim()
      .toLowerCase();

    const status = this.selectedStatus
      .trim()
      .toLowerCase();

    return this.vehicles.filter(vehicle => {

      const matchesSearch =
        !search ||
        vehicle.machine_number
          ?.toLowerCase()
          .includes(search) ||
        vehicle.company
          ?.toLowerCase()
          .includes(search) ||
        vehicle.v_type
          ?.toLowerCase()
          .includes(search) ||
        vehicle.driver_names
          ?.toLowerCase()
          .includes(search);

      /*
       * The original API data shown in the JSP does not contain
       * a vehicle status field.
       *
       * Therefore status filtering cannot be performed reliably
       * until the backend provides a status property.
       */
      const matchesStatus =
        !status ||
        status === this.getVehicleStatus(vehicle).toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }

  applyFilters(): void {
    /*
     * Filtering is handled by filteredVehicles.
     * Keeping this method makes the button behavior explicit.
     */
  }

  clearFilters(): void {

    this.selectedStatus = '';
    this.searchText = '';
  }

  // ==========================================================
  // Vehicle Details
  // ==========================================================

  openVehicleDetails(vehicle: Vehicle): void {

    this.selectedVehicle = vehicle;
    this.showModal = true;
  }

  formatDriverNames(value?: string): string {
    if (!value?.trim()) {
      return 'N/A';
    }

    const names = value.trim();
    if (names.includes(',')) {
      return names
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .join(', ');
    }

    return names.replace(
      /(Sushant\s+Chaudhari)\s+(Omkar\s+Darek[ae]r)/i,
      '$1, $2',
    );
  }

  closeModal(): void {

    this.showModal = false;
    this.selectedVehicle = null;
  }

  // ==========================================================
  // Vehicle Report
  // ==========================================================

  openMachineDetails(vehicle: Vehicle): void {

    void this.router.navigate(
      ['/vehicle-details'],
      {
        queryParams: {
          vType: vehicle.v_type,
          driverName: vehicle.machine_number,
        },
      }
    );
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  getVehicleStatus(vehicle: Vehicle): string {

    /*
     * The current /api/vehicles/getAll response used by the
     * original JSP does not expose status.
     *
     * Until the backend provides it, return Active as the
     * default display status.
     */
    return 'Active';
  }

  getStatusClass(status: string): string {

    switch (status.toLowerCase()) {

      case 'active':
        return 'status-active';

      case 'maintenance':
        return 'status-maintenance';

      case 'unavailable':
        return 'status-unavailable';

      default:
        return 'status-default';
    }
  }

  trackByVehicleId(
    index: number,
    vehicle: Vehicle
  ): number {

    return vehicle.vehicle_id;
  }
}
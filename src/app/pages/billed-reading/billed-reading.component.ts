import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { parseVehicleOptions, VehicleOption } from '../../core/utils/vehicle-option';
import { Host } from '../../core/services/host';

interface MachineReading {
  id: number | string;
  orderName?: string | null;
  machineNumber?: string | null;
  date?: string | null;
  startReading?: number | string | null;
  endReading?: number | string | null;
  diesel?: number | string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMachineReading(value: unknown): value is MachineReading {
  if (!isObject(value) || (typeof value['id'] !== 'number' && typeof value['id'] !== 'string')) {
    return false;
  }
  return (
    ['orderName', 'machineNumber', 'date'].every(
      (key) => value[key] === undefined || value[key] === null || typeof value[key] === 'string',
    ) &&
    ['startReading', 'endReading', 'diesel'].every(
      (key) =>
        value[key] === undefined ||
        value[key] === null ||
        typeof value[key] === 'number' ||
        typeof value[key] === 'string',
    )
  );
}

@Component({
  selector: 'app-billed-reading',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billed-reading.component.html',
  styleUrl: './billed-reading.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BilledReadingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  readings: MachineReading[] = [];
  vehicles: VehicleOption[] = [];
  selectedVehicle = '';
  searchTerm = '';
  loadingReadings = false;
  loadingVehicles = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadReadings();
    this.loadVehicles();
  }

  get filteredReadings(): MachineReading[] {
    const query = this.searchTerm.trim().toLowerCase();
    return this.readings.filter((reading) => {
      const matchesVehicle = !this.selectedVehicle || reading.machineNumber === this.selectedVehicle;
      const matchesQuery =
        !query ||
        [
          reading.id,
          reading.orderName,
          reading.machineNumber,
          reading.date,
          reading.startReading,
          reading.endReading,
          reading.diesel,
          this.calculateHours(reading),
        ].some((value) => String(value ?? '').toLowerCase().includes(query));
      return matchesVehicle && matchesQuery;
    });
  }

  get totalHours(): number {
    return this.filteredReadings.reduce((sum, reading) => sum + (this.hoursValue(reading) ?? 0), 0);
  }

  get totalDiesel(): number {
    return this.filteredReadings.reduce((sum, reading) => sum + this.numberValue(reading.diesel), 0);
  }

  loadReadings(): void {
    this.loadingReadings = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/vehicle/getAll/billed`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isMachineReading)) {
          console.error('Unexpected response from billed machine readings API:', response);
          this.readings = [];
          this.errorMessage = 'The billed readings service returned an unexpected response.';
        } else {
          this.readings = [...response].sort((left, right) => this.compareIds(right.id, left.id));
        }
        this.loadingReadings = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load billed machine readings:', error);
        this.loadingReadings = false;
        this.errorMessage = 'Unable to load billed readings. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  loadVehicles(): void {
    this.loadingVehicles = true;
    this.http.get<unknown>(`${this.apiUrl}/api/vehicles/getAll`).subscribe({
      next: (response) => {
        const vehicles = parseVehicleOptions(response);
        if (vehicles === null) {
          console.error('Unexpected response from billed reading vehicles API:', response);
          this.errorMessage = 'The vehicles service returned an unexpected response.';
          this.vehicles = [];
        } else {
          this.vehicles = vehicles;
        }
        this.loadingVehicles = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load vehicles for billed reading filter:', error);
        this.loadingVehicles = false;
        this.errorMessage = 'Unable to load vehicles. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  vehicleNumber(vehicle: VehicleOption): string {
    return vehicle.machineNumber || vehicle.machine_number || 'Vehicle';
  }

  calculateHours(reading: MachineReading): string {
    const hours = this.hoursValue(reading);
    return hours === null ? 'N/A' : this.formatNumber(hours);
  }

  formatNumber(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
      .format(this.numberValue(value));
  }

  printReport(): void {
    window.print();
  }

  private hoursValue(reading: MachineReading): number | null {
    if (
      reading.startReading === undefined ||
      reading.startReading === null ||
      reading.startReading === '' ||
      reading.endReading === undefined ||
      reading.endReading === null ||
      reading.endReading === ''
    ) {
      return null;
    }
    const start = Number(reading.startReading);
    const end = Number(reading.endReading);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
  }

  private numberValue(value: number | string | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private compareIds(left: number | string, right: number | string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : String(left).localeCompare(String(right));
  }
}

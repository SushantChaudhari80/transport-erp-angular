import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Host } from '../../core/services/host';

interface MachineDriver {
  id: number;
  driverName: string;
}

interface MachineReading {
  id: number;
  date?: string;
  startReading?: number | string;
  endReading?: number | string;
  maintenance?: string;
  diesel?: number | string;
  driverName?: string;
}

interface ReadingDetails {
  startReading?: string | null;
  endReading?: string | null;
  disel?: string | null;
  startReadingCount?: string | number | null;
  endReadingCount?: string | number | null;
}

interface ReadingForm {
  startReading: string;
  endReading: string;
  diesel: string;
  startReadingCount?: string;
  endReadingCount?: string;
}

function isReadingDetails(value: unknown): value is ReadingDetails {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

@Component({
  selector: 'app-vehicle-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './vehicle-details.component.html',
  styleUrl: './vehicle-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleDetailsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  readonly machineNumber =
    this.route.snapshot.queryParamMap.get('driverName')?.trim() ?? '';
  readonly vehicleType = this.route.snapshot.queryParamMap.get('vType')?.trim() ?? '';

  drivers: MachineDriver[] = [];
  readings: MachineReading[] = [];
  availableDrivers: MachineDriver[] = [];
  selectedDriverId = '';
  loadingDrivers = false;
  loadingReadings = false;
  loadingDriverOptions = false;
  assigningDriver = false;
  savingReading = false;
  loadingReadingDetails = false;
  removingDriverId: number | null = null;
  errorMessage = '';
  successMessage = '';
  showAssignDriverModal = false;
  showReadingModal = false;
  showImagePreview = false;
  selectedReadingId: number | null = null;
  readingDetails: ReadingDetails | null = null;
  readingForm: ReadingForm = this.emptyReadingForm();
  readingError = '';
  imagePreviewUrl = '';

  ngOnInit(): void {
    if (!this.machineNumber) {
      this.errorMessage = 'Vehicle number was not provided.';
      return;
    }

    this.loadDrivers();
    this.loadReadings();
  }

  get showReadingsTable(): boolean {
    return this.vehicleType.toLowerCase() !== 'dumper';
  }

  loadDrivers(): void {
    this.loadingDrivers = true;
    this.http
      .get<unknown>(`${this.apiUrl}/api/driver/getByMachineNumber`, {
        params: new HttpParams().set('i', this.machineNumber),
      })
      .subscribe({
        next: (response) => {
          if (!Array.isArray(response)) {
            console.error('Unexpected response from machine drivers API:', response);
            this.errorMessage = 'The drivers service returned an unexpected response.';
            this.drivers = [];
          } else {
            this.drivers = response;
          }
          this.loadingDrivers = false;
          this.changeDetectorRef.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Unable to load drivers for vehicle:', error);
          this.errorMessage = 'Unable to load drivers for this vehicle.';
          this.loadingDrivers = false;
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  loadReadings(): void {
    if (!this.showReadingsTable) {
      return;
    }

    this.loadingReadings = true;
    this.http
      .get<unknown>(`${this.apiUrl}/vehicle/getRecords`, {
        params: new HttpParams().set('machinN', this.machineNumber),
      })
      .subscribe({
        next: (response) => {
          if (!Array.isArray(response)) {
            console.error('Unexpected response from vehicle readings API:', response);
            this.errorMessage = 'The machine readings service returned an unexpected response.';
            this.readings = [];
          } else {
            this.readings = response;
          }
          this.loadingReadings = false;
          this.changeDetectorRef.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Unable to load vehicle readings:', error);
          this.errorMessage = 'Unable to load machine readings.';
          this.loadingReadings = false;
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  openAssignDriverModal(): void {
    this.showAssignDriverModal = true;
    this.selectedDriverId = '';
    this.loadingDriverOptions = true;
    this.http.get<unknown>(`${this.apiUrl}/api/driver/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response)) {
          console.error('Unexpected response from driver list API:', response);
          this.errorMessage = 'The drivers service returned an unexpected response.';
          this.availableDrivers = [];
        } else {
          this.availableDrivers = response;
        }
        this.loadingDriverOptions = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load available drivers:', error);
        this.errorMessage = 'Unable to load available drivers.';
        this.loadingDriverOptions = false;
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  closeAssignDriverModal(): void {
    if (this.assigningDriver) {
      return;
    }
    this.showAssignDriverModal = false;
  }

  assignDriver(): void {
    if (!this.selectedDriverId || this.assigningDriver) {
      return;
    }

    this.assigningDriver = true;
    const params = new HttpParams()
      .set('mNumber', this.machineNumber)
      .set('DriverId', this.selectedDriverId);

    this.http.get(`${this.apiUrl}/api/driver/assignDriver`, {
      params,
      responseType: 'text',
    }).subscribe({
      next: (response) => {
        console.log('Assign driver API response:', response);
        this.assigningDriver = false;
        this.showAssignDriverModal = false;
        this.successMessage = 'Driver assigned successfully.';
        this.loadDrivers();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to assign driver:', error);
        this.assigningDriver = false;
        this.errorMessage = 'Unable to assign driver. Please try again.';
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  removeDriver(driver: MachineDriver): void {
    if (this.removingDriverId !== null) {
      return;
    }

    this.removingDriverId = driver.id;
    this.http.get(`${this.apiUrl}/api/driver/remove`, {
      params: new HttpParams().set('DriverName', driver.driverName),
      responseType: 'text',
    }).subscribe({
      next: (response) => {
        console.log('Remove driver API response:', response);
        this.removingDriverId = null;
        this.successMessage = 'Driver removed successfully.';
        this.loadDrivers();
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to remove driver:', error);
        this.removingDriverId = null;
        this.errorMessage = 'Unable to remove driver. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  openReading(reading: MachineReading): void {
    if (!reading.id) {
      this.errorMessage = 'This reading does not have a valid ID.';
      return;
    }

    this.selectedReadingId = reading.id;
    this.readingError = '';
    this.readingDetails = null;
    this.readingForm = this.emptyReadingForm();
    this.loadingReadingDetails = true;
    this.showReadingModal = true;
    this.http.get<unknown>(`${this.apiUrl}/admin/reading/getById`, {
      params: new HttpParams().set('id', reading.id),
    }).subscribe({
      next: (response) => {
        if (!isReadingDetails(response)) {
          console.error('Unexpected response from reading details API:', response);
          this.readingError = 'The reading service returned an unexpected response.';
        } else {
          this.readingDetails = response;
          this.readingForm = {
            startReading: response.startReadingCount?.toString() ?? '',
            endReading: response.endReadingCount?.toString() ?? '',
            diesel: '',
            startReadingCount: response.startReadingCount?.toString() ?? '',
            endReadingCount: response.endReadingCount?.toString() ?? '',
          };
        }
        this.loadingReadingDetails = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load reading details:', error);
        this.loadingReadingDetails = false;
        this.readingError = 'Failed to load reading data.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  closeReadingModal(): void {
    if (this.savingReading) {
      return;
    }
    this.showReadingModal = false;
    this.selectedReadingId = null;
    this.readingDetails = null;
  }

  saveReading(): void {
    if (this.selectedReadingId === null || this.savingReading) {
      return;
    }

    this.savingReading = true;
    this.readingError = '';
    const formData = new FormData();
    formData.append('id', this.selectedReadingId.toString());
    formData.append('startReading', this.readingForm.startReading);
    formData.append('endReading', this.readingForm.endReading);
    formData.append('diesel', this.readingForm.diesel);

    this.http.put(`${this.apiUrl}/admin/reading`, formData, {
      responseType: 'text',
    }).subscribe({
      next: (response) => {
        console.log('Update reading API response:', response);
        this.savingReading = false;
        this.showReadingModal = false;
        this.successMessage = 'Reading updated successfully.';
        this.loadReadings();
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to update reading:', error);
        this.savingReading = false;
        this.readingError = 'Error updating reading. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  openImagePreview(source?: string): void {
    if (!source) {
      return;
    }
    this.imagePreviewUrl = this.toImageUrl(source);
    this.showImagePreview = true;
  }

  closeImagePreview(): void {
    this.showImagePreview = false;
    this.imagePreviewUrl = '';
  }

  toImageUrl(source?: string | null): string {
    if (!source) {
      return '';
    }
    return source.startsWith('data:') || source.startsWith('http')
      ? source
      : `data:image/jpeg;base64,${source}`;
  }

  calculateTotalHours(reading: MachineReading): number | string {
    const start = Number(reading.startReading);
    const end = Number(reading.endReading);
    if (!Number.isFinite(start) || !Number.isFinite(end) || !reading.startReading || !reading.endReading) {
      return 'N/A';
    }
    return end - start;
  }

  private emptyReadingForm(): ReadingForm {
    return { startReading: '', endReading: '', diesel: '' };
  }
}

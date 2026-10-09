import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Host } from '../../core/services/host';

interface BilledTrip {
  id: number | string;
  createDate?: string | null;
  item?: string | null;
  customerName?: string | null;
  selectedVehicle?: string | null;
  diesel?: number | string | null;
  advance?: number | string | null;
  soilBrass?: number | string | null;
  soilRate?: number | string | null;
  totalPayment?: number | string | null;
}

function isBilledTrip(value: unknown): value is BilledTrip {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const trip = value as Record<string, unknown>;
  return (
    (typeof trip['id'] === 'number' || typeof trip['id'] === 'string') &&
    ['createDate', 'item', 'customerName', 'selectedVehicle'].every(
      (key) => trip[key] === undefined || trip[key] === null || typeof trip[key] === 'string',
    ) &&
    ['diesel', 'advance', 'soilBrass', 'soilRate', 'totalPayment'].every(
      (key) =>
        trip[key] === undefined ||
        trip[key] === null ||
        typeof trip[key] === 'number' ||
        typeof trip[key] === 'string',
    )
  );
}

@Component({
  selector: 'app-billed-trips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billed-trips.component.html',
  styleUrl: './billed-trips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BilledTripsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  trips: BilledTrip[] = [];
  searchTerm = '';
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadTrips();
  }

  get filteredTrips(): BilledTrip[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.trips;
    }
    return this.trips.filter((trip) =>
      [
        trip.id,
        trip.createDate,
        trip.item,
        trip.customerName,
        trip.selectedVehicle,
        trip.diesel,
        trip.advance,
        trip.soilBrass,
        trip.soilRate,
        trip.totalPayment,
      ].some((value) => String(value ?? '').toLowerCase().includes(query)),
    );
  }

  get totalAdvance(): number {
    return this.filteredTrips.reduce((sum, trip) => sum + this.numericValue(trip.advance), 0);
  }

  get totalPayment(): number {
    return this.filteredTrips.reduce((sum, trip) => sum + this.numericValue(trip.totalPayment), 0);
  }

  get totalDiesel(): number {
    return this.filteredTrips.reduce((sum, trip) => sum + this.numericValue(trip.diesel), 0);
  }

  get duePayment(): number {
    return this.totalPayment - this.totalAdvance;
  }

  loadTrips(): void {
    this.loading = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/api/treep/getAll/billed`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isBilledTrip)) {
          console.error('Unexpected response from billed trips API:', response);
          this.trips = [];
          this.errorMessage = 'The billed trips service returned an unexpected response.';
        } else {
          this.trips = [...response].sort((left, right) => this.compareIds(right.id, left.id));
        }
        this.loading = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load billed trips:', error);
        this.loading = false;
        this.errorMessage = 'Unable to load billed trips. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  formatNumber(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
      .format(this.numericValue(value));
  }

  printReport(): void {
    window.print();
  }

  private numericValue(value: number | string | null | undefined): number {
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

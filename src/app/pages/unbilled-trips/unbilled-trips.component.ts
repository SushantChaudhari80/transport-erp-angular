import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Customer } from '../../models/dashboard.model';
import { Host } from '../../core/services/host';

interface UnbilledTrip {
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

function isUnbilledTrip(value: unknown): value is UnbilledTrip {
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

function isCustomer(value: unknown): value is Customer {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

@Component({
  selector: 'app-unbilled-trips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './unbilled-trips.component.html',
  styleUrl: './unbilled-trips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnbilledTripsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  trips: UnbilledTrip[] = [];
  selectedTripIds = new Set<string>();
  customer: Customer | null = null;
  searchTerm = '';
  loading = false;
  generatingInvoice = false;
  showInvoiceModal = false;
  errorMessage = '';
  successMessage = '';
  invoiceError = '';
  advancePayment: number | null = null;
  soilRateOverride: number | null = null;
  gstPercent = 0;

  ngOnInit(): void {
    this.loadTrips();
  }

  get filteredTrips(): UnbilledTrip[] {
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

  get selectedTrips(): UnbilledTrip[] {
    return this.trips.filter((trip) => this.selectedTripIds.has(String(trip.id)));
  }

  get allVisibleSelected(): boolean {
    return this.filteredTrips.length > 0 &&
      this.filteredTrips.every((trip) => this.selectedTripIds.has(String(trip.id)));
  }

  get totalAdvance(): number {
    return this.filteredTrips.reduce((sum, trip) => sum + this.numberValue(trip.advance), 0);
  }

  get totalPayment(): number {
    return this.filteredTrips.reduce((sum, trip) => sum + this.numberValue(trip.totalPayment), 0);
  }

  get totalDiesel(): number {
    return this.filteredTrips.reduce((sum, trip) => sum + this.numberValue(trip.diesel), 0);
  }

  get duePayment(): number {
    return this.totalPayment - this.totalAdvance;
  }

  get invoiceSubtotal(): number {
    return this.selectedTrips.reduce((sum, trip) => {
      const rate = this.soilRateOverride ?? this.numberValue(trip.soilRate);
      return sum + this.numberValue(trip.soilBrass) * rate;
    }, 0);
  }

  get invoiceTax(): number {
    return this.invoiceSubtotal * this.numberValue(this.gstPercent) / 100 * 2;
  }

  get invoiceTotal(): number {
    return this.invoiceSubtotal + this.invoiceTax;
  }

  get invoiceDue(): number {
    return this.invoiceTotal - (this.advancePayment ?? 0);
  }

  loadTrips(): void {
    this.loading = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/api/treep/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isUnbilledTrip)) {
          console.error('Unexpected response from unbilled trips API:', response);
          this.trips = [];
          this.errorMessage = 'The unbilled trips service returned an unexpected response.';
        } else {
          this.trips = [...response].sort((left, right) => this.compareIds(left.id, right.id));
          const activeIds = new Set(this.trips.map((trip) => String(trip.id)));
          this.selectedTripIds = new Set(
            [...this.selectedTripIds].filter((id) => activeIds.has(id)),
          );
        }
        this.loading = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load unbilled trips:', error);
        this.loading = false;
        this.errorMessage = 'Unable to load unbilled trips. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  isTripSelected(trip: UnbilledTrip): boolean {
    return this.selectedTripIds.has(String(trip.id));
  }

  toggleTrip(trip: UnbilledTrip): void {
    const id = String(trip.id);
    if (this.selectedTripIds.has(id)) {
      this.selectedTripIds.delete(id);
    } else {
      this.selectedTripIds.add(id);
    }
  }

  toggleVisibleTrips(): void {
    const updated = new Set(this.selectedTripIds);
    if (this.allVisibleSelected) {
      this.filteredTrips.forEach((trip) => updated.delete(String(trip.id)));
    } else {
      this.filteredTrips.forEach((trip) => updated.add(String(trip.id)));
    }
    this.selectedTripIds = updated;
  }

  openInvoiceModal(): void {
    if (this.selectedTrips.length === 0) {
      this.errorMessage = 'Select at least one trip to generate an invoice.';
      return;
    }
    this.advancePayment = this.selectedTrips.reduce(
      (sum, trip) => sum + this.numberValue(trip.advance),
      0,
    );
    this.soilRateOverride = null;
    this.gstPercent = 0;
    this.invoiceError = '';
    this.showInvoiceModal = true;
    this.changeDetectorRef.markForCheck();
  }

  closeInvoiceModal(): void {
    if (this.generatingInvoice) {
      return;
    }
    this.showInvoiceModal = false;
    this.invoiceError = '';
  }

  generateInvoice(): void {
    if (this.generatingInvoice) {
      return;
    }
    const selected = this.selectedTrips;
    if (selected.length === 0) {
      this.invoiceError = 'Select at least one trip.';
      return;
    }
    if (
      this.advancePayment === null ||
      !Number.isFinite(this.advancePayment) ||
      this.advancePayment < 0 ||
      !Number.isFinite(this.gstPercent) ||
      this.gstPercent < 0 ||
      (this.soilRateOverride !== null &&
        (!Number.isFinite(this.soilRateOverride) || this.soilRateOverride < 0))
    ) {
      this.invoiceError = 'Enter valid non-negative invoice adjustments.';
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.invoiceError = 'Allow pop-ups to generate and print the invoice.';
      return;
    }

    this.generatingInvoice = true;
    this.invoiceError = '';
    this.errorMessage = '';
    this.loadInvoiceOwner(selected, printWindow);
  }

  formatNumber(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
      .format(this.numberValue(value));
  }

  printReport(): void {
    window.print();
  }

  private loadInvoiceOwner(selected: UnbilledTrip[], printWindow: Window): void {
    this.http.get<unknown>(`${this.apiUrl}/api/customers/get`).subscribe({
      next: (response) => {
        if (!isCustomer(response)) {
          console.error('Unexpected response from customer details API:', response);
          this.failInvoice('The customer details service returned an unexpected response.', printWindow);
          return;
        }
        this.customer = response;
        this.markTripsBilled(selected, printWindow);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load invoice customer details:', error);
        this.failInvoice('Unable to load business details for the invoice.', printWindow);
      },
    });
  }

  private markTripsBilled(selected: UnbilledTrip[], printWindow: Window): void {
    const updates = selected.map((trip) =>
      this.http.post(
        `${this.apiUrl}/api/treep/updateTreep/${encodeURIComponent(String(trip.id))}`,
        null,
        { responseType: 'text' },
      ),
    );
    forkJoin(updates).subscribe({
      next: () => this.saveInvoice(selected, printWindow),
      error: (error: HttpErrorResponse) => {
        console.error('Unable to mark selected trips as billed:', error);
        this.failInvoice(
          'Invoice generation stopped because one or more trips could not be marked billed. Verify trip status before retrying.',
          printWindow,
        );
      },
    });
  }

  private saveInvoice(selected: UnbilledTrip[], printWindow: Window): void {
    const invoiceHtml = this.buildInvoiceHtml(selected);
    const payload = {
      billedDate: this.formattedToday(),
      invoice: invoiceHtml,
    };
    this.http.put(`${this.apiUrl}/api/invoice/save`, payload, { responseType: 'text' }).subscribe({
      next: (response) => {
        console.log('Save generated invoice API response:', response);
        if (!printWindow.closed) {
          printWindow.document.open();
          printWindow.document.write(invoiceHtml);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
        this.generatingInvoice = false;
        this.showInvoiceModal = false;
        this.successMessage = response.trim() || 'Invoice saved successfully.';
        this.selectedTripIds.clear();
        this.loadTrips();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to save generated invoice:', error);
        this.failInvoice(
          'The selected trips were marked billed, but saving the invoice failed. Contact support before retrying.',
          printWindow,
        );
      },
    });
  }

  private buildInvoiceHtml(selected: UnbilledTrip[]): string {
    const owner = this.customer ?? {};
    const billedDate = escapeHtml(this.formattedToday());
    const businessName = escapeHtml(owner.bussinessName || owner.name || 'Business');
    const rows = selected.map((trip) => {
      const rate = this.soilRateOverride ?? this.numberValue(trip.soilRate);
      const rowTotal = this.numberValue(trip.soilBrass) * rate;
      return `<tr>
        <td>${escapeHtml(trip.id)}</td><td>${escapeHtml(trip.createDate || '')}</td>
        <td>${escapeHtml(trip.item || '')}</td><td>${escapeHtml(trip.customerName || '')}</td>
        <td>${escapeHtml(trip.selectedVehicle || 'N/A')}</td><td>${escapeHtml(trip.diesel ?? 0)}</td>
        <td>${escapeHtml(trip.advance ?? 0)}</td><td>${escapeHtml(trip.soilBrass ?? 0)}</td>
        <td>${this.formatNumber(rate)}</td><td>${this.formatNumber(rowTotal)}</td>
      </tr>`;
    }).join('');
    const cgst = this.invoiceSubtotal * this.numberValue(this.gstPercent) / 100;
    const sgst = cgst;

    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Tax Invoice</title>
      <style>
        body{font:12px Arial,sans-serif;margin:0;color:#111}
        .invoice{max-width:1100px;margin:20px auto;padding:20px;border:1px solid #222}
        h1,.center{text-align:center}h1{font-size:22px;margin:0}
        h2{text-align:center;text-decoration:underline;font-size:17px}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{border:1px solid #333;padding:6px;text-align:left}
        th{background:#f1f1f1}.section{margin:15px 0}
        .bank,.footer{margin-top:18px;padding:10px;border:1px solid #333}
        .footer{text-align:center;border:0}
        @media print{.invoice{border:0;margin:0;max-width:none}}
      </style></head><body><main class="invoice">
      <header class="center"><h1>${businessName}</h1>
        <p>${escapeHtml(owner.address || '')}</p><h2>TAX INVOICE</h2></header>
      <section class="section"><table><tbody>
        <tr><th>Invoice No:</th><td>${escapeHtml(owner.name || '')}</td><th>GSTIN:</th><td>${escapeHtml(owner.gstNo || '')}</td></tr>
        <tr><th>Invoice Date:</th><td>${billedDate}</td><th>Reverse Charge:</th><td>No</td></tr>
        <tr><th>Place of Supply:</th><td>Maharashtra</td><th>Code:</th><td>27</td></tr>
      </tbody></table></section>
      <section class="section"><table><tbody>
        <tr><th colspan="2">Details of Receiver / Billed To</th><th colspan="2">Shipping Details</th></tr>
        <tr><th>Name:</th><td>${escapeHtml(selected[0]?.customerName || '')}</td><th>Shipping Address:</th><td></td></tr>
        <tr><th>Address:</th><td></td><th>Date of Supply:</th><td>${billedDate}</td></tr>
        <tr><th>GSTIN:</th><td></td><th>Code:</th><td>27</td></tr>
      </tbody></table></section>
      <section class="section"><table><thead><tr>
        <th>Trip ID</th><th>Date</th><th>Details</th><th>Customer</th><th>Vehicle</th>
        <th>Diesel (L)</th><th>Advance</th><th>Soil Qty</th><th>Rate</th><th>Total</th>
      </tr></thead><tbody>${rows}</tbody></table></section>
      <section class="section"><table><tbody>
        <tr><th>Net Taxable Value</th><td colspan="6">${this.formatNumber(this.invoiceSubtotal)}</td></tr>
        <tr><th>CGST @ ${this.formatNumber(this.gstPercent)}%</th><td colspan="6">${this.formatNumber(cgst)}</td></tr>
        <tr><th>SGST @ ${this.formatNumber(this.gstPercent)}%</th><td colspan="6">${this.formatNumber(sgst)}</td></tr>
        <tr><th>Total Tax</th><td colspan="6">${this.formatNumber(this.invoiceTax)}</td></tr>
        <tr><th>Total Invoice Value</th><td colspan="6">${this.formatNumber(this.invoiceTotal)}</td></tr>
        <tr><th>Total Amount to Pay</th><td colspan="6">${this.formatNumber(this.advancePayment ?? 0)}</td></tr>
        <tr><th>Total Due Amount</th><td colspan="6">${this.formatNumber(this.invoiceDue)}</td></tr>
      </tbody></table></section>
      <section class="bank"><p><strong>Bank Name:</strong> ${escapeHtml(owner.bankName || '')}</p>
        <p><strong>Bank A/C:</strong> ${escapeHtml(owner.acNo || '')}</p>
        <p><strong>IFSC:</strong> ${escapeHtml(owner.ifsc || '')}</p></section>
      <footer class="footer"><p>Certified that the particulars given above are true and correct</p>
        <p>For ${businessName}</p><p><strong>Authorized Signatory</strong></p></footer>
      </main></body></html>`;
  }

  private failInvoice(message: string, printWindow: Window): void {
    if (!printWindow.closed) {
      printWindow.close();
    }
    this.generatingInvoice = false;
    this.invoiceError = message;
    this.changeDetectorRef.detectChanges();
  }

  private formattedToday(): string {
    return new Intl.DateTimeFormat('en-GB').format(new Date());
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

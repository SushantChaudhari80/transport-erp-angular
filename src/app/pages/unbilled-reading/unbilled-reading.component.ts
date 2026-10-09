import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Customer } from '../../models/dashboard.model';
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

function isCustomer(value: unknown): value is Customer {
  return isObject(value);
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
  selector: 'app-unbilled-reading',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './unbilled-reading.component.html',
  styleUrl: './unbilled-reading.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnbilledReadingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  readings: MachineReading[] = [];
  vehicles: VehicleOption[] = [];
  selectedReadingIds = new Set<string>();
  selectedVehicle = '';
  searchTerm = '';
  loadingReadings = false;
  loadingVehicles = false;
  generatingInvoice = false;
  showInvoiceModal = false;
  errorMessage = '';
  successMessage = '';
  invoiceError = '';
  hourlyRate: number | null = null;
  advancePayment: number | null = null;
  gstPercent = 0;
  customer: Customer | null = null;

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

  get selectedReadings(): MachineReading[] {
    return this.readings.filter((reading) => this.selectedReadingIds.has(String(reading.id)));
  }

  get allVisibleSelected(): boolean {
    return this.filteredReadings.length > 0 &&
      this.filteredReadings.every((reading) => this.isSelected(reading));
  }

  get reportTotalHours(): number {
    return this.filteredReadings.reduce((sum, reading) => sum + this.hoursValue(reading), 0);
  }

  get totalDiesel(): number {
    return this.filteredReadings.reduce((sum, reading) => sum + this.numberValue(reading.diesel), 0);
  }

  get selectedHours(): number {
    return this.selectedReadings.reduce((sum, reading) => sum + this.hoursValue(reading), 0);
  }

  get invoiceSubtotal(): number {
    return this.selectedHours * this.numberValue(this.hourlyRate);
  }

  get invoiceTax(): number {
    return this.invoiceSubtotal * this.numberValue(this.gstPercent) / 100 * 2;
  }

  get invoiceTotal(): number {
    return this.invoiceSubtotal + this.invoiceTax;
  }

  get invoiceDue(): number {
    return this.invoiceTotal - this.numberValue(this.advancePayment);
  }

  loadReadings(): void {
    this.loadingReadings = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/vehicle/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isMachineReading)) {
          console.error('Unexpected response from unbilled machine readings API:', response);
          this.readings = [];
          this.errorMessage = 'The unbilled readings service returned an unexpected response.';
        } else {
          this.readings = [...response].sort((left, right) => this.compareIds(right.id, left.id));
          const availableIds = new Set(this.readings.map((reading) => String(reading.id)));
          this.selectedReadingIds = new Set(
            [...this.selectedReadingIds].filter((id) => availableIds.has(id)),
          );
        }
        this.loadingReadings = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load unbilled machine readings:', error);
        this.loadingReadings = false;
        this.errorMessage = 'Unable to load unbilled readings. Please try again.';
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
          console.error('Unexpected response from machine reading vehicles API:', response);
          this.errorMessage = 'The vehicles service returned an unexpected response.';
          this.vehicles = [];
        } else {
          this.vehicles = vehicles;
        }
        this.loadingVehicles = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load vehicles for machine reading filter:', error);
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
    if (
      reading.startReading === undefined ||
      reading.startReading === null ||
      reading.startReading === '' ||
      reading.endReading === undefined ||
      reading.endReading === null ||
      reading.endReading === ''
    ) {
      return 'N/A';
    }
    const start = Number(reading.startReading);
    const end = Number(reading.endReading);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return 'N/A';
    }
    return this.formatNumber(end - start);
  }

  isSelected(reading: MachineReading): boolean {
    return this.selectedReadingIds.has(String(reading.id));
  }

  toggleReading(reading: MachineReading): void {
    const id = String(reading.id);
    if (this.selectedReadingIds.has(id)) {
      this.selectedReadingIds.delete(id);
    } else {
      this.selectedReadingIds.add(id);
    }
  }

  toggleVisibleReadings(): void {
    const updated = new Set(this.selectedReadingIds);
    if (this.allVisibleSelected) {
      this.filteredReadings.forEach((reading) => updated.delete(String(reading.id)));
    } else {
      this.filteredReadings.forEach((reading) => updated.add(String(reading.id)));
    }
    this.selectedReadingIds = updated;
  }

  openInvoiceModal(): void {
    if (this.selectedReadings.length === 0) {
      this.errorMessage = 'Select at least one reading to generate an invoice.';
      return;
    }
    this.hourlyRate = null;
    this.advancePayment = 0;
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
    if (this.selectedReadings.length === 0) {
      this.invoiceError = 'Select at least one reading.';
      return;
    }
    if (
      this.hourlyRate === null ||
      !Number.isFinite(this.hourlyRate) ||
      this.hourlyRate < 0 ||
      this.advancePayment === null ||
      !Number.isFinite(this.advancePayment) ||
      this.advancePayment < 0 ||
      !Number.isFinite(this.gstPercent) ||
      this.gstPercent < 0
    ) {
      this.invoiceError = 'Enter a valid hourly rate and non-negative advance/GST values.';
      return;
    }
    if (this.selectedReadings.some((reading) => this.totalHoursNumber(reading) === null)) {
      this.invoiceError = 'Every selected reading must have valid end and start readings.';
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
    this.loadInvoiceCustomer(printWindow);
  }

  formatNumber(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
      .format(this.numberValue(value));
  }

  printReport(): void {
    window.print();
  }

  private loadInvoiceCustomer(printWindow: Window): void {
    this.http.get<unknown>(`${this.apiUrl}/api/customers/get`).subscribe({
      next: (response) => {
        if (!isCustomer(response)) {
          console.error('Unexpected response from invoice customer API:', response);
          this.failInvoice('The customer details service returned an unexpected response.', printWindow);
          return;
        }
        this.customer = response;
        this.markSelectedReadingsBilled(printWindow);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load invoice customer details:', error);
        this.failInvoice('Unable to load business details for the invoice.', printWindow);
      },
    });
  }

  private markSelectedReadingsBilled(printWindow: Window): void {
    const updates = this.selectedReadings.map((reading) =>
      this.http.post(
        `${this.apiUrl}/api/reading/updateReading/${encodeURIComponent(String(reading.id))}`,
        null,
        { responseType: 'text' },
      ),
    );
    forkJoin(updates).subscribe({
      next: () => this.saveInvoice(printWindow),
      error: (error: HttpErrorResponse) => {
        console.error('Unable to mark selected readings billed:', error);
        this.failInvoice(
          'Invoice generation stopped because one or more readings could not be marked billed. Verify reading status before retrying.',
          printWindow,
        );
      },
    });
  }

  private saveInvoice(printWindow: Window): void {
    const invoiceHtml = this.buildInvoiceHtml();
    this.http.put(
      `${this.apiUrl}/api/invoice/save`,
      { billedDate: this.formattedToday(), invoice: invoiceHtml },
      { responseType: 'text' },
    ).subscribe({
      next: (response) => {
        console.log('Save reading invoice API response:', response);
        if (!printWindow.closed) {
          printWindow.document.open();
          printWindow.document.write(invoiceHtml);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
        this.generatingInvoice = false;
        this.showInvoiceModal = false;
        this.selectedReadingIds.clear();
        this.successMessage = response.trim() || 'Invoice saved successfully.';
        this.loadReadings();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to save machine reading invoice:', error);
        this.failInvoice(
          'The selected readings were marked billed, but saving the invoice failed. Contact support before retrying.',
          printWindow,
        );
      },
    });
  }

  private buildInvoiceHtml(): string {
    const customer = this.customer ?? {};
    const businessName = escapeHtml(customer.bussinessName || customer.name || 'Business');
    const rows = this.selectedReadings.map((reading) => {
      const hours = this.totalHoursNumber(reading) ?? 0;
      return `<tr>
        <td>${escapeHtml(reading.orderName || '')}</td>
        <td>${escapeHtml(reading.machineNumber || '')}</td>
        <td>${escapeHtml(reading.date || '')}</td>
        <td>${this.formatNumber(hours)}</td>
        <td>${this.formatNumber(hours * this.numberValue(this.hourlyRate))}</td>
      </tr>`;
    }).join('');
    const cgst = this.invoiceSubtotal * this.numberValue(this.gstPercent) / 100;
    const sgst = cgst;
    const date = escapeHtml(this.formattedToday());

    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1"><title>Machine Reading Tax Invoice</title>
      <style>
        body{font:12px Arial,sans-serif;margin:0;color:#111}.invoice{max-width:1100px;margin:20px auto;padding:20px;border:1px solid #222}
        h1,.center{text-align:center}h1{font-size:22px;margin:0}h2{text-align:center;text-decoration:underline;font-size:17px}
        table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #333;padding:7px;text-align:left}
        th{background:#f1f1f1}.section{margin:16px 0}.bank{margin-top:18px;padding:10px;border:1px solid #333}
        .footer{text-align:center;margin-top:18px}@media print{.invoice{border:0;margin:0;max-width:none}}
      </style></head><body><main class="invoice">
      <header class="center"><h1>${businessName}</h1><p>${escapeHtml(customer.address || '')}</p><h2>TAX INVOICE</h2></header>
      <section class="section"><table><tbody>
        <tr><th>Invoice No:</th><td>${escapeHtml(customer.name || '')}</td><th>GSTIN:</th><td>${escapeHtml(customer.gstNo || '')}</td></tr>
        <tr><th>Invoice Date:</th><td>${date}</td><th>Reverse Charge:</th><td>No</td></tr>
        <tr><th>Place of Supply of Services:</th><td>Maharashtra</td><th>Code:</th><td>27</td></tr>
      </tbody></table></section>
      <section class="section"><table><tbody>
        <tr><th colspan="2">Details of Receiver / Billed To</th><th colspan="2">Shipping Details</th></tr>
        <tr><th>Name:</th><td>${escapeHtml(this.selectedReadings[0]?.orderName || '')}</td><th>Shipping Address:</th><td></td></tr>
        <tr><th>Address:</th><td></td><th>Date of Supply:</th><td>${date}</td></tr>
        <tr><th>GSTIN:</th><td></td><th>Code:</th><td>27</td></tr>
      </tbody></table></section>
      <section class="section"><table><thead><tr>
        <th>Customer Name</th><th>Machine Number</th><th>Date</th><th>Total Hours</th><th>Amount</th>
      </tr></thead><tbody>${rows}</tbody></table></section>
      <section class="section"><table><tbody>
        <tr><th>Net Taxable Value</th><td>${this.formatNumber(this.invoiceSubtotal)}</td></tr>
        <tr><th>Hourly Rate</th><td>${this.formatNumber(this.hourlyRate)}</td></tr>
        <tr><th>CGST @ ${this.formatNumber(this.gstPercent)}%</th><td>${this.formatNumber(cgst)}</td></tr>
        <tr><th>SGST @ ${this.formatNumber(this.gstPercent)}%</th><td>${this.formatNumber(sgst)}</td></tr>
        <tr><th>Total Tax Amount</th><td>${this.formatNumber(this.invoiceTax)}</td></tr>
        <tr><th>Total Invoice Value</th><td>${this.formatNumber(this.invoiceTotal)}</td></tr>
        <tr><th>Total Amount to Pay</th><td>${this.formatNumber(this.advancePayment)}</td></tr>
        <tr><th>Total Due Amount</th><td>${this.formatNumber(this.invoiceDue)}</td></tr>
      </tbody></table></section>
      <section class="bank"><p><strong>Bank Name:</strong> ${escapeHtml(customer.bankName || '')}</p>
        <p><strong>Bank A/C:</strong> ${escapeHtml(customer.acNo || '')}</p>
        <p><strong>IFSC:</strong> ${escapeHtml(customer.ifsc || '')}</p></section>
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

  private hoursValue(reading: MachineReading): number {
    return this.totalHoursNumber(reading) ?? 0;
  }

  private totalHoursNumber(reading: MachineReading): number | null {
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

  private formattedToday(): string {
    return new Intl.DateTimeFormat('en-GB').format(new Date());
  }

  private compareIds(left: number | string, right: number | string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : String(left).localeCompare(String(right));
  }
}

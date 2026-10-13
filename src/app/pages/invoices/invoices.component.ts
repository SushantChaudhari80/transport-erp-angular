import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Host } from '../../core/services/host';

interface Invoice {
  id: number | string;
  billedDate?: string | null;
  customerName?: string | null;
}

function isInvoice(value: unknown): value is Invoice {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const invoice = value as Record<string, unknown>;
  return (
    (typeof invoice['id'] === 'number' || typeof invoice['id'] === 'string') &&
    (invoice['billedDate'] === undefined ||
      invoice['billedDate'] === null ||
      typeof invoice['billedDate'] === 'string') &&
    (invoice['customerName'] === undefined ||
      invoice['customerName'] === null ||
      typeof invoice['customerName'] === 'string')
  );
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');

  invoices: Invoice[] = [];
  searchTerm = '';
  loading = false;
  openingInvoiceId: number | string | null = null;
  errorMessage = '';

  ngOnInit(): void {
    this.loadInvoices();
  }

  get filteredInvoices(): Invoice[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.invoices;
    }
    return this.invoices.filter((invoice) =>
      [invoice.id, invoice.billedDate, invoice.customerName].some((value) =>
        String(value ?? '').toLowerCase().includes(query),
      ),
    );
  }

  loadInvoices(): void {
    this.loading = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/api/invoice/getAllInvoice`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isInvoice)) {
          console.error('Unexpected response from invoices API:', response);
          this.invoices = [];
          this.errorMessage = 'The invoice service returned an unexpected response.';
        } else {
          this.invoices = [...response].sort((left, right) => this.compareIds(right.id, left.id));
        }
        this.loading = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load invoices:', error);
        this.loading = false;
        this.errorMessage = 'Unable to load invoices. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  openInvoice(invoice: Invoice): void {
    if (this.openingInvoiceId !== null) {
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.errorMessage = 'Allow pop-ups to open and print the invoice.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.openingInvoiceId = invoice.id;
    this.errorMessage = '';
    this.http.get(`${this.apiUrl}/api/invoice/getById/${encodeURIComponent(String(invoice.id))}`, {
      responseType: 'text',
    }).subscribe({
      next: (invoiceHtml) => {
        if (printWindow.closed) {
          this.errorMessage = 'The invoice window was closed before it could be displayed.';
          this.openingInvoiceId = null;
          this.changeDetectorRef.markForCheck();
          return;
        }

        printWindow.document.open();
        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        this.openingInvoiceId = null;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error(`Unable to load invoice ${invoice.id}:`, error);
        if (!printWindow.closed) {
          printWindow.close();
        }
        this.openingInvoiceId = null;
        this.errorMessage = 'Unable to open this invoice. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  private compareIds(left: number | string, right: number | string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : String(left).localeCompare(String(right));
  }
}

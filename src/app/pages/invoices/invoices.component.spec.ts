import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Host } from '../../core/services/host';
import { InvoicesComponent } from './invoices.component';

describe('InvoicesComponent', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoicesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads and sorts invoices and filters by date or ID', () => {
    const fixture = TestBed.createComponent(InvoicesComponent);
    fixture.detectChanges();

    httpTesting.expectOne(`${apiUrl}/api/invoice/getAllInvoice`).flush([
      { id: 1, billedDate: '2026-09-01', customerName: 'Northwind' },
      { id: 10, billedDate: '2026-10-01', customerName: 'Deepika Kale' },
      { id: 2, billedDate: '2026-08-01', customerName: 'Ratnagiri Site' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.invoices.map((invoice) => invoice.id)).toEqual([10, 2, 1]);
    fixture.componentInstance.searchTerm = '2026-08';
    expect(fixture.componentInstance.filteredInvoices.map((invoice) => invoice.id)).toEqual([2]);

    fixture.componentInstance.searchTerm = 'deepika';
    expect(fixture.componentInstance.filteredInvoices.map((invoice) => invoice.id)).toEqual([10]);
    expect(fixture.nativeElement.textContent).toContain('Customer Name');
    expect(fixture.nativeElement.textContent).toContain('Deepika Kale');
  });

  it('loads invoices with the API response fields and nullable customer data', () => {
    const fixture = TestBed.createComponent(InvoicesComponent);
    fixture.detectChanges();

    httpTesting.expectOne(`${apiUrl}/api/invoice/getAllInvoice`).flush([
      {
        billedDate: '04/10/2026',
        invoice: '<html><body>Tax invoice</body></html>',
        customerName: 'Deepika Kale',
        omobile: '9370637150',
        id: 'INV1791094389236',
      },
      {
        billedDate: null,
        invoice: '<html><body>Older invoice</body></html>',
        customerName: null,
        omobile: '9370637150',
        id: 'INV1791094389235',
      },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage).toBe('');
    expect(fixture.componentInstance.invoices).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Deepika Kale');
    expect(fixture.nativeElement.textContent).toContain('INV1791094389236');
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('fetches the selected invoice and opens the returned HTML for printing', () => {
    const fixture = TestBed.createComponent(InvoicesComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/invoice/getAllInvoice`).flush([]);

    const writtenContent: string[] = [];
    const printWindow = {
      closed: false,
      document: {
        open: vi.fn(),
        write: (html: string) => writtenContent.push(html),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);

    fixture.componentInstance.openInvoice({ id: 25, billedDate: '2026-10-04' });
    const request = httpTesting.expectOne(`${apiUrl}/api/invoice/getById/25`);
    expect(request.request.responseType).toBe('text');
    request.flush('<html><body>Invoice 25</body></html>');

    expect(writtenContent).toEqual(['<html><body>Invoice 25</body></html>']);
    expect(printWindow.document.open).toHaveBeenCalled();
    expect(printWindow.document.close).toHaveBeenCalled();
    expect(printWindow.focus).toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalled();
    expect(fixture.componentInstance.openingInvoiceId).toBeNull();
  });

  it('reports a blocked popup without making an invoice request', () => {
    const fixture = TestBed.createComponent(InvoicesComponent);
    fixture.detectChanges();
    httpTesting.expectOne(`${apiUrl}/api/invoice/getAllInvoice`).flush([]);
    vi.spyOn(window, 'open').mockReturnValue(null);

    fixture.componentInstance.openInvoice({ id: 25 });

    expect(fixture.componentInstance.errorMessage).toContain('Allow pop-ups');
    httpTesting.expectNone(`${apiUrl}/api/invoice/getById/25`);
  });
});

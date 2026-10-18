import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { Host } from '../../core/services/host';
import {
  calculatePortfolioMetrics,
  filterRowsWithinOrderDates,
  formatPortfolioDate,
  getDeliveryDuration,
  isDieselFuelEntry,
  parsePortfolioDate,
  PortfolioDateRange,
  PortfolioMetrics,
  PortfolioResponse,
  PortfolioRow,
  PortfolioScalar,
  portfolioRow,
  toAmount,
} from './portfolio-calculations';

type PortfolioSection =
  | 'overview'
  | 'orders'
  | 'billing'
  | 'fleet'
  | 'trips'
  | 'readings'
  | 'driver-payments'
  | 'vouchers';

type DatePreset = 'all' | 'today' | 'last7' | 'last30' | 'thisMonth' | 'previousMonth' | 'custom';
type BillingFilter = 'all' | 'billed' | 'unbilled';

interface AggregatedAmount {
  label: string;
  amount: number | null;
  count: number;
}

interface OrderChoice {
  value: string;
  label: string;
  disabled: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPortfolioResponse(value: unknown): value is PortfolioResponse {
  if (!isObject(value) || typeof value['customer_name'] !== 'string') {
    return false;
  }

  const arrays = [
    'machine_numbers',
    'orders',
    'invoices',
    'payments',
    'vehicles',
    'drivers',
    'driver_payments',
    'vouchers',
    'dumper_trips',
    'machine_readings',
  ];

  return arrays.every((key) => {
    const records = value[key];
    return (
      Array.isArray(records) &&
      (key === 'machine_numbers'
        ? records.every((item) => typeof item === 'string')
        : records.every(portfolioRow))
    );
  });
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayValue(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

@Component({
  selector: 'app-portfolio',
  imports: [CommonModule, FormsModule],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioComponent implements OnInit, AfterViewChecked {
  private readonly http = inject(HttpClient);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = Host.API_URL.replace(/\/+$/, '');
  private paymentChart: Chart | null = null;
  private activityChart: Chart | null = null;
  private chartNeedsUpdate = false;

  @ViewChild('paymentChartCanvas') private paymentChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('activityChartCanvas') private activityChartCanvas?: ElementRef<HTMLCanvasElement>;

  customers: string[] = [];
  selectedCustomer = '';
  selectedOrderIndex = '';
  portfolio: PortfolioResponse | null = null;
  loadingCustomers = false;
  loadingPortfolio = false;
  errorMessage = '';
  lastRefreshed: Date | null = null;
  activeSection: PortfolioSection = 'overview';
  searchTerm = '';
  datePreset: DatePreset = 'all';
  fromDate = '';
  toDate = '';
  billingFilter: BillingFilter = 'all';
  pageSize = 10;
  private readonly pageIndices: Record<string, number> = {};
  sortField = '';
  sortAscending = true;

  readonly sections: { id: PortfolioSection; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'billing', label: 'Invoices & payments' },
    { id: 'fleet', label: 'Vehicles & drivers' },
    { id: 'trips', label: 'Dumper trips' },
    { id: 'readings', label: 'Machine readings' },
    { id: 'driver-payments', label: 'Driver payments' },
    { id: 'vouchers', label: 'Vouchers' },
  ];

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngAfterViewChecked(): void {
    if (this.chartNeedsUpdate) {
      this.chartNeedsUpdate = false;
      this.renderCharts();
    }
  }

  get dateRange(): PortfolioDateRange {
    return {
      start: this.fromDate ? parsePortfolioDate(this.fromDate) : null,
      end: this.toDate ? parsePortfolioDate(this.toDate) : null,
    };
  }

  get invalidDateRange(): boolean {
    return !!this.dateRange.start && !!this.dateRange.end &&
      this.dateRange.start.getTime() > this.dateRange.end.getTime();
  }

  get metrics(): PortfolioMetrics | null {
    return this.portfolio
      ? calculatePortfolioMetrics(this.portfolio, this.dateRange)
      : null;
  }

  get orderChoices(): OrderChoice[] {
    return (this.portfolio?.orders ?? []).map((order, index) => {
      const start = parsePortfolioDate(order['order_date']);
      const delivery = parsePortfolioDate(order['delivery_date']);
      const hasDeliveryDate = this.hasDateValue(order['delivery_date']);
      const isCompleted = delivery !== null;
      const startIsValid = start !== null &&
        (!hasDeliveryDate || delivery !== null) &&
        (!delivery || delivery >= start);
      return {
        value: String(index),
        label: `Order #${displayValue(order['id'])} · ${isCompleted ? 'Completed' : 'In process'} · ${this.formatDate(order['order_date'])} – ${delivery ? this.formatDate(order['delivery_date']) : 'Today'}`,
        disabled: !startIsValid,
      };
    });
  }

  get filteredOrders(): PortfolioRow[] {
    return this.filterRows(this.portfolio?.orders ?? [], 'order_date');
  }

  get filteredInvoices(): PortfolioRow[] {
    return this.filterRows(this.portfolio?.invoices ?? [], 'billed_date');
  }

  get filteredPayments(): PortfolioRow[] {
    return this.filterRows(this.portfolio?.payments ?? [], 'payment_date');
  }

  get filteredVehicles(): PortfolioRow[] {
    return this.filterRows(this.portfolio?.vehicles ?? [], '');
  }

  get filteredDrivers(): PortfolioRow[] {
    return this.filterRows(this.portfolio?.drivers ?? [], '');
  }

  get filteredTrips(): PortfolioRow[] {
    const rows = this.filterRows(this.portfolio?.dumper_trips ?? [], 'create_date');
    return this.filterBillingStatus(rows, 'is_billed');
  }

  get filteredReadings(): PortfolioRow[] {
    const rows = this.filterRows(this.portfolio?.machine_readings ?? [], 'reading_date');
    return this.filterBillingStatus(rows.filter((row) => !isDieselFuelEntry(row)), 'billed');
  }

  get filteredFuelEntries(): PortfolioRow[] {
    return this.filterRows(
      (this.portfolio?.machine_readings ?? []).filter(isDieselFuelEntry),
      'reading_date',
    );
  }

  get filteredDriverPayments(): PortfolioRow[] {
    return this.filterRows(this.portfolio?.driver_payments ?? [], 'payment_date');
  }

  get filteredVouchers(): PortfolioRow[] {
    return this.filterRows(this.portfolio?.vouchers ?? [], 'create_date');
  }

  get readingRows(): PortfolioRow[] {
    return [...this.filteredReadings, ...this.filteredFuelEntries];
  }

  get activeRows(): PortfolioRow[] {
    switch (this.activeSection) {
      case 'overview':
        return this.filteredOrders;
      case 'orders':
        return this.filteredOrders;
      case 'billing':
        return [...this.filteredInvoices, ...this.filteredPayments];
      case 'fleet':
        return [...this.filteredVehicles, ...this.filteredDrivers];
      case 'trips':
        return this.filteredTrips;
      case 'readings':
        return [...this.filteredReadings, ...this.filteredFuelEntries];
      case 'driver-payments':
        return this.filteredDriverPayments;
      case 'vouchers':
        return this.filteredVouchers;
      default:
        return [];
    }
  }

  loadCustomers(): void {
    this.loadingCustomers = true;
    this.errorMessage = '';
    this.http.get<unknown>(`${this.apiUrl}/api/order/getAll`).subscribe({
      next: (response) => {
        if (!Array.isArray(response) || !response.every(isObject)) {
          console.error('Unexpected customer/order list response:', response);
          this.errorMessage = 'Unable to read customers from the order service.';
          this.customers = [];
        } else {
          const customerNames = response
            .map((order) => order['customer_name'])
            .filter((name): name is string => typeof name === 'string' && !!name.trim())
            .map((name) => name.trim());
          this.customers = [...new Set(customerNames)].sort((left, right) =>
            left.localeCompare(right),
          );
          if (this.selectedCustomer && !this.customers.includes(this.selectedCustomer)) {
            this.selectedCustomer = '';
            this.portfolio = null;
          }
        }
        this.loadingCustomers = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load customers for portfolio:', error);
        this.loadingCustomers = false;
        this.errorMessage = 'Unable to load customer list. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  selectCustomer(): void {
    this.portfolio = null;
    this.resetOrderSelection();
    this.errorMessage = '';
    this.resetPages();
    if (!this.selectedCustomer) {
      this.markChartsDirty();
      return;
    }
    this.loadPortfolio();
  }

  loadPortfolio(): void {
    if (!this.selectedCustomer) {
      return;
    }
    this.loadingPortfolio = true;
    this.errorMessage = '';
    const params = new HttpParams().set('customerName', this.selectedCustomer);
    this.http.get<unknown>(`${this.apiUrl}/api/portfolio`, { params }).subscribe({
      next: (response) => {
        if (!isPortfolioResponse(response)) {
          console.error('Unexpected customer portfolio response:', response);
          this.portfolio = null;
          this.errorMessage = 'The portfolio service returned data in an unexpected format.';
        } else {
          this.portfolio = response;
          this.resetOrderSelection();
          this.lastRefreshed = new Date();
          this.resetPages();
        }
        this.loadingPortfolio = false;
        this.markChartsDirty();
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Unable to load customer portfolio:', error);
        this.portfolio = null;
        this.loadingPortfolio = false;
        this.errorMessage = 'Unable to load this customer portfolio. Please try again.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  refresh(): void {
    if (this.selectedCustomer) {
      this.loadPortfolio();
    } else {
      this.loadCustomers();
    }
  }

  setDatePreset(preset: DatePreset): void {
    this.selectedOrderIndex = '';
    this.datePreset = preset;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    switch (preset) {
      case 'today':
        break;
      case 'last7':
        start.setDate(start.getDate() - 6);
        break;
      case 'last30':
        start.setDate(start.getDate() - 29);
        break;
      case 'thisMonth':
        start.setDate(1);
        break;
      case 'previousMonth':
        start.setMonth(start.getMonth() - 1, 1);
        end.setDate(0);
        break;
      case 'all':
        this.fromDate = '';
        this.toDate = '';
        this.onFiltersChanged();
        return;
      case 'custom':
        if (this.fromDate || this.toDate) {
          this.onFiltersChanged();
        }
        return;
    }
    this.fromDate = toDateInputValue(start);
    this.toDate = toDateInputValue(end);
    this.onFiltersChanged();
  }

  onCustomDateChanged(): void {
    this.selectedOrderIndex = '';
    this.datePreset = 'custom';
    this.onFiltersChanged();
  }

  onOrderSelectionChanged(): void {
    this.errorMessage = '';
    if (this.selectedOrderIndex === '') {
      this.setDatePreset('all');
      return;
    }

    const selectedIndex = Number(this.selectedOrderIndex);
    const order = this.portfolio?.orders[selectedIndex];
    const start = order ? parsePortfolioDate(order['order_date']) : null;
    const delivery = order ? parsePortfolioDate(order['delivery_date']) : null;
    const hasDeliveryDate = order ? this.hasDateValue(order['delivery_date']) : false;
    if (
      !order ||
      !start ||
      (hasDeliveryDate && !delivery) ||
      (delivery && delivery < start)
    ) {
      this.selectedOrderIndex = '';
      this.errorMessage = 'The selected order does not have a valid date range.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const end = delivery ?? new Date();
    this.datePreset = 'custom';
    this.fromDate = toDateInputValue(start);
    this.toDate = toDateInputValue(end);
    this.onFiltersChanged();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.billingFilter = 'all';
    this.selectedOrderIndex = '';
    this.datePreset = 'all';
    this.fromDate = '';
    this.toDate = '';
    this.onFiltersChanged();
  }

  private resetOrderSelection(): void {
    this.selectedOrderIndex = '';
    this.datePreset = 'all';
    this.fromDate = '';
    this.toDate = '';
  }

  private hasDateValue(value: PortfolioScalar | undefined): boolean {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  onFiltersChanged(): void {
    this.resetPages();
    this.markChartsDirty();
  }

  setSection(section: PortfolioSection): void {
    this.activeSection = section;
    this.resetPages();
    this.markChartsDirty();
  }

  setBillingFilter(filter: BillingFilter): void {
    this.billingFilter = filter;
    this.resetPages();
  }

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortField = field;
      this.sortAscending = true;
    }
    this.resetPages();
  }

  pageNumber(key: string): number {
    return this.pageIndices[key] ?? 0;
  }

  pageCount(rows: PortfolioRow[], _key: string): number {
    return Math.max(1, Math.ceil(rows.length / this.pageSize));
  }

  paged(rows: PortfolioRow[], key: string): PortfolioRow[] {
    const start = this.pageNumber(key) * this.pageSize;
    return this.sortRows(rows).slice(start, start + this.pageSize);
  }

  changePage(key: string, direction: -1 | 1, rows: PortfolioRow[]): void {
    this.pageIndices[key] = Math.min(
      Math.max(0, this.pageNumber(key) + direction),
      this.pageCount(rows, key) - 1,
    );
  }

  formatMoney(value: number | null | undefined): string {
    return value === null || value === undefined
      ? 'Not available'
      : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;
  }

  formatNumber(value: number | null | undefined): string {
    return value === null || value === undefined
      ? '—'
      : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
  }

  formatFuelVolume(value: number | null | undefined): string {
    return value === null || value === undefined
      ? 'Not available'
      : `${this.formatNumber(value)} L`;
  }

  formatDate(value: unknown): string {
    return formatPortfolioDate(value);
  }

  value(row: PortfolioRow, field: string): string {
    return displayValue(row[field]);
  }

  get customerMachineNumbers(): string {
    return this.portfolio?.machine_numbers.join(', ') || 'No vehicle numbers listed';
  }

  duration(order: PortfolioRow): string {
    const days = getDeliveryDuration(order);
    return days === null ? 'In progress / unavailable' : `${days} days`;
  }

  toNumber(value: PortfolioScalar | undefined): number | null {
    return toAmount(value);
  }

  billedStatus(value: PortfolioRow['is_billed']): string {
    return value === true || String(value).toLowerCase() === 'true' ? 'Billed' : 'Unbilled';
  }

  readingKind(reading: PortfolioRow): string {
    return isDieselFuelEntry(reading) ? 'Fuel entry' : 'Machine reading';
  }

  driverVehicle(driverName: PortfolioScalar): string {
    const driver = String(driverName ?? '').toLocaleLowerCase();
    const machines = (this.portfolio?.drivers ?? [])
      .filter((item) => String(item['driver_name'] ?? '').toLocaleLowerCase() === driver)
      .map((item) => String(item['machine_number'] ?? '').trim())
      .filter(Boolean);
    return [...new Set(machines)].join(', ') || 'Not mapped';
  }

  driverPaymentsFor(driverName: PortfolioScalar): number | null {
    const driver = String(driverName ?? '').toLocaleLowerCase();
    const payments = this.filteredDriverPayments.filter(
      (payment) => String(payment['driver_name'] ?? '').toLocaleLowerCase() === driver,
    );
    if (payments.length === 0) {
      return 0;
    }
    const amounts = payments.map((payment) => toAmount(payment['amount']));
    return amounts.some((amount) => amount === null)
      ? null
      : amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  }

  get driverPaymentTotalsByDriver(): AggregatedAmount[] {
    return this.aggregateDriverPayments('driver_name');
  }

  get driverPaymentTotalsByDate(): AggregatedAmount[] {
    return this.aggregateDriverPayments('payment_date', true);
  }

  vehicleDrivers(vehicle: PortfolioRow): string {
    const machine = String(vehicle['machine_number'] ?? '').toLocaleLowerCase();
    const drivers = (this.portfolio?.drivers ?? [])
      .filter((driver) => String(driver['machine_number'] ?? '').toLocaleLowerCase() === machine)
      .map((driver) => String(driver['driver_name'] ?? '').trim())
      .filter(Boolean);
    return [...new Set(drivers)].join(', ') || 'Not mapped';
  }

  readingUsage(reading: PortfolioRow): string {
    const start = toAmount(reading['start_reading']);
    const end = toAmount(reading['end_reading']);
    return start === null || end === null || end < start
      ? 'Unavailable'
      : this.formatNumber(end - start);
  }

  orderOperationalActivity(order: PortfolioRow): string {
    const customer = String(order['customer_name'] ?? '').trim().toLocaleLowerCase();
    const machines = new Set(
      String(order['machins'] ?? '')
        .split(',')
        .map((machine) => machine.trim().toLocaleLowerCase())
        .filter(Boolean),
    );
    if (!customer || machines.size === 0) {
      return 'No reliable operational mapping';
    }
    const trips = this.filteredTrips.filter(
      (trip) =>
        String(trip['customer_name'] ?? '').trim().toLocaleLowerCase() === customer &&
        machines.has(String(trip['selected_vehicle'] ?? '').trim().toLocaleLowerCase()),
    ).length;
    const readings = this.filteredReadings.filter(
      (reading) =>
        String(reading['order_name'] ?? '').trim().toLocaleLowerCase() === customer &&
        machines.has(String(reading['machine_number'] ?? '').trim().toLocaleLowerCase()),
    ).length;
    return `${trips} trips · ${readings} readings`;
  }

  voucherActivity(machineNumber: PortfolioScalar): string {
    const machine = String(machineNumber ?? '').toLocaleLowerCase();
    const vouchers = this.filteredVouchers.filter(
      (voucher) => String(voucher['machine_number'] ?? '').toLocaleLowerCase() === machine,
    );
    const amount = vouchers.map((voucher) => toAmount(voucher['amount']));
    const total = amount.some((value) => value === null)
      ? null
      : amount.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return `${vouchers.length} vouchers · ${this.formatMoney(total)}`;
  }

  vehicleActivity(machineNumber: PortfolioScalar): string {
    const machine = String(machineNumber ?? '').toLocaleLowerCase();
    const trips = this.filteredTrips.filter(
      (trip) => String(trip['selected_vehicle'] ?? '').toLocaleLowerCase() === machine,
    ).length;
    const readings = this.filteredReadings.filter(
      (reading) => String(reading['machine_number'] ?? '').toLocaleLowerCase() === machine,
    ).length;
    return `${trips} trips · ${readings} readings`;
  }

  exportReport(): void {
    if (this.activeSection === 'overview' && this.metrics) {
      const metrics = this.metrics;
      const csv = [
        ['Metric', 'Value'],
        ['Customer', this.selectedCustomer],
        ['Total orders', String(metrics.orderCount)],
        ['Order advances', this.formatMoney(metrics.orderAdvance)],
        ['Total order value', this.formatMoney(metrics.totalOrderValue)],
        ['Total invoice count', String(metrics.invoiceCount)],
        ['Customer payments', this.formatMoney(metrics.customerPayments)],
        ['Outstanding balance', this.formatMoney(metrics.outstandingBalance)],
        ['Driver payment volume', this.formatMoney(metrics.driverPaymentVolume)],
        ['Voucher amount', this.formatMoney(metrics.voucherAmount)],
        ['Recorded fuel (L)', this.formatFuelVolume(metrics.recordedFuelLiters)],
        ['Operational expenses', this.formatMoney(metrics.totalOperationalExpenses)],
        ['Estimated net profit', this.formatMoney(metrics.estimatedProfit)],
        ['Dumper trips', String(metrics.dumperTripCount)],
        ['Billed trips', String(metrics.billedTrips)],
        ['Unbilled trips', String(metrics.unbilledTrips)],
        ['Machine readings', String(metrics.machineReadingCount)],
        ['Billed readings', String(metrics.billedReadings)],
        ['Unbilled readings', String(metrics.unbilledReadings)],
      ].map((row) => row.map(csvCell).join(',')).join('\r\n');
      this.downloadCsv(csv, 'overview');
      return;
    }
    const rows = this.activeRows;
    if (rows.length === 0) {
      return;
    }
    const typedRows = rows.map((row) => ({ record_type: this.activeSection, ...row }));
    const columns = [...new Set(typedRows.flatMap((row) => Object.keys(row)))];
    const csv = [
      columns.map(csvCell).join(','),
      ...this.sortRows(typedRows).map((row) =>
        columns.map((column) => csvCell(row[column])).join(','),
      ),
    ].join('\r\n');
    this.downloadCsv(csv, this.activeSection);
  }

  private downloadCsv(csv: string, section: string): void {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio-${this.selectedCustomer.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${section}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private aggregateDriverPayments(field: string, dateField = false): AggregatedAmount[] {
    const groups = new Map<string, number[]>();
    const invalidGroups = new Set<string>();
    for (const payment of this.filteredDriverPayments) {
      const source = payment[field];
      const label = dateField
        ? this.formatDate(source) === '—' ? 'Date unavailable' : this.formatDate(source)
        : displayValue(source);
      const values = groups.get(label) ?? [];
      const amount = toAmount(payment['amount']);
      if (amount === null) {
        invalidGroups.add(label);
      } else {
        values.push(amount);
      }
      groups.set(label, values);
    }
    return [...groups.entries()]
      .map(([label, amounts]) => ({
        label,
        amount: invalidGroups.has(label)
          ? null
          : amounts.reduce((sum, amount) => sum + amount, 0),
        count: this.filteredDriverPayments.filter((payment) => {
          const value = payment[field];
          const paymentLabel = dateField
            ? this.formatDate(value) === '—' ? 'Date unavailable' : this.formatDate(value)
            : displayValue(value);
          return paymentLabel === label;
        }).length,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  private filterRows(rows: PortfolioRow[], dateField: string): PortfolioRow[] {
    const dateFiltered = dateField
      ? filterRowsWithinOrderDates(
          rows,
          dateField,
          this.portfolio?.orders ?? [],
          this.dateRange,
        )
      : rows;
    const query = this.searchTerm.trim().toLocaleLowerCase();
    if (!query) {
      return dateFiltered;
    }
    return dateFiltered.filter((row) =>
      Object.values(row).some((field) => String(field ?? '').toLocaleLowerCase().includes(query)),
    );
  }

  private filterBillingStatus(rows: PortfolioRow[], field: string): PortfolioRow[] {
    if (this.billingFilter === 'all') {
      return rows;
    }
    return rows.filter((row) => this.billedStatus(row[field]) ===
      (this.billingFilter === 'billed' ? 'Billed' : 'Unbilled'));
  }

  private sortRows(rows: PortfolioRow[]): PortfolioRow[] {
    if (!this.sortField) {
      return rows;
    }
    return [...rows].sort((left, right) => {
      const a = left[this.sortField];
      const b = right[this.sortField];
      const numericA = toAmount(a);
      const numericB = toAmount(b);
      const comparison =
        numericA !== null && numericB !== null
          ? numericA - numericB
          : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
      return this.sortAscending ? comparison : -comparison;
    });
  }

  private markChartsDirty(): void {
    this.chartNeedsUpdate = true;
  }

  private resetPages(): void {
    for (const key of Object.keys(this.pageIndices)) {
      delete this.pageIndices[key];
    }
  }

  private renderCharts(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.paymentChart?.destroy();
    this.activityChart?.destroy();
    this.paymentChart = null;
    this.activityChart = null;

    if (this.activeSection !== 'overview' || !this.portfolio) {
      return;
    }

    const paymentsByDate = new Map<string, number>();
    for (const payment of this.filteredPayments) {
      const amount = toAmount(payment['payment']);
      if (amount === null) {
        continue;
      }
      const date = this.formatDate(payment['payment_date']);
      if (date === '—') {
        continue;
      }
      paymentsByDate.set(
        date,
        (paymentsByDate.get(date) ?? 0) + amount,
      );
    }
    const paymentData = [...paymentsByDate.entries()].sort(
      ([left], [right]) => (parsePortfolioDate(left)?.getTime() ?? 0) -
        (parsePortfolioDate(right)?.getTime() ?? 0),
    );
    if (this.paymentChartCanvas) {
      this.paymentChart = new Chart(this.paymentChartCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: paymentData.map(([date]) => date),
          datasets: [{
            label: 'Customer payments',
            data: paymentData.map(([, amount]) => amount),
            backgroundColor: '#1769aa',
            borderRadius: 5,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (tick) => `₹${new Intl.NumberFormat('en-IN').format(Number(tick))}` },
            },
          },
        },
      });
    }

    if (!this.activityChartCanvas || !this.metrics) {
      return;
    }
    this.activityChart = new Chart(this.activityChartCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Billed trips', 'Unbilled trips', 'Billed readings', 'Unbilled readings'],
        datasets: [{
          label: 'Activity count',
          data: [
            this.metrics.billedTrips,
            this.metrics.unbilledTrips,
            this.metrics.billedReadings,
            this.metrics.unbilledReadings,
          ],
          backgroundColor: ['#12b76a', '#f79009', '#2e90fa', '#f97066'],
          borderRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

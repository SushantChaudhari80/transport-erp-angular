export type PortfolioScalar = string | number | boolean | null;
export type PortfolioRow = Record<string, PortfolioScalar>;

export interface PortfolioResponse {
  customer_name: string;
  machine_numbers: string[];
  orders: PortfolioRow[];
  invoices: PortfolioRow[];
  payments: PortfolioRow[];
  vehicles: PortfolioRow[];
  drivers: PortfolioRow[];
  driver_payments: PortfolioRow[];
  vouchers: PortfolioRow[];
  dumper_trips: PortfolioRow[];
  machine_readings: PortfolioRow[];
}

export interface PortfolioDateRange {
  start: Date | null;
  end: Date | null;
}

export interface PortfolioMetrics {
  orderCount: number;
  orderAdvance: number | null;
  invoiceCount: number;
  customerPayments: number | null;
  driverPaymentTransactions: number;
  driverPaymentVolume: number | null;
  voucherCount: number;
  voucherAmount: number | null;
  dumperTripCount: number;
  billedTrips: number;
  unbilledTrips: number;
  machineReadingCount: number;
  billedReadings: number;
  unbilledReadings: number;
  dieselFuelEntries: number;
  recordedFuelLiters: number | null;
  totalMachineHours: number | null;
  totalOrderValue: number | null;
  outstandingBalance: number | null;
  totalOperationalExpenses: null;
  estimatedProfit: number | null;
}

export function portfolioRow(value: unknown): value is PortfolioRow {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (field) =>
        field === null ||
        typeof field === 'string' ||
        typeof field === 'number' ||
        typeof field === 'boolean',
    )
  );
}

export function parsePortfolioDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const input = value.trim();
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (isoDate) {
    return validDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
  }

  const localDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (localDate) {
    return validDate(Number(localDate[3]), Number(localDate[2]), Number(localDate[1]));
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function filterRowsByDate(
  rows: PortfolioRow[],
  dateField: string,
  range: PortfolioDateRange,
): PortfolioRow[] {
  if (!range.start && !range.end) {
    return rows;
  }

  return rows.filter((row) => {
    const date = parsePortfolioDate(row[dateField]);
    if (!date) {
      return false;
    }
    const dateValue = localDay(date).getTime();
    return (
      (!range.start || dateValue >= localDay(range.start).getTime()) &&
      (!range.end || dateValue <= localDay(range.end).getTime())
    );
  });
}

export function isDieselFuelEntry(reading: PortfolioRow): boolean {
  return (
    reading['driver_name'] === null &&
    reading['billed'] === null &&
    typeof reading['petrol_pump'] === 'string' &&
    !!reading['petrol_pump'].trim() &&
    reading['fuel_rate'] !== null &&
    reading['fuel_rate'] !== undefined
  );
}

export function calculatePortfolioMetrics(
  portfolio: PortfolioResponse,
  range: PortfolioDateRange,
): PortfolioMetrics {
  const orders = filterRowsByDate(portfolio.orders, 'order_date', range);
  const invoices = filterRowsByDate(portfolio.invoices, 'billed_date', range);
  const payments = filterRowsByDate(portfolio.payments, 'payment_date', range);
  const driverPayments = filterRowsByDate(portfolio.driver_payments, 'payment_date', range);
  const vouchers = filterRowsByDate(portfolio.vouchers, 'create_date', range);
  const trips = filterRowsByDate(portfolio.dumper_trips, 'create_date', range);
  const readings = filterRowsByDate(portfolio.machine_readings, 'reading_date', range);
  const fuelEntries = readings.filter(isDieselFuelEntry);
  const machineReadings = readings.filter((reading) => !isDieselFuelEntry(reading));
  const totalMachineHours = sumMachineReadingHours(machineReadings);
  const tripValue = sumOptionalField(trips, 'total_payment');
  const totalOrderValue = totalMachineHours === null || tripValue === null
    ? null
    : totalMachineHours * 2500 + tripValue;
  const customerPayments = sumField(payments, 'payment');
  const driverPaymentVolume = sumField(driverPayments, 'amount');
  const voucherAmount = sumField(vouchers, 'amount');
  const recordedFuelLiters = sumOptionalField(readings, 'diesel');

  return {
    orderCount: orders.length,
    orderAdvance: sumField(orders, 'advance'),
    invoiceCount: invoices.length,
    customerPayments,
    driverPaymentTransactions: driverPayments.length,
    driverPaymentVolume,
    voucherCount: vouchers.length,
    voucherAmount,
    dumperTripCount: trips.length,
    billedTrips: trips.filter((trip) => isBilled(trip['is_billed'])).length,
    unbilledTrips: trips.filter((trip) => !isBilled(trip['is_billed'])).length,
    machineReadingCount: machineReadings.length,
    billedReadings: machineReadings.filter((reading) => isBilled(reading['billed'])).length,
    unbilledReadings: machineReadings.filter((reading) => !isBilled(reading['billed'])).length,
    dieselFuelEntries: fuelEntries.length,
    recordedFuelLiters,
    totalMachineHours,
    totalOrderValue,
    outstandingBalance: totalOrderValue === null || customerPayments === null
      ? null
      : totalOrderValue - customerPayments,
    totalOperationalExpenses: null,
    estimatedProfit:
      totalOrderValue === null ||
      driverPaymentVolume === null ||
      voucherAmount === null ||
      recordedFuelLiters === null
        ? null
        : totalOrderValue - driverPaymentVolume - voucherAmount - recordedFuelLiters * 98,
  };
}

export function toAmount(value: PortfolioScalar | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const amount = Number(value.trim());
  return Number.isFinite(amount) ? amount : null;
}

export function formatPortfolioDate(value: unknown): string {
  const date = parsePortfolioDate(value);
  return date ? new Intl.DateTimeFormat('en-GB').format(date) : '—';
}

export function getDeliveryDuration(order: PortfolioRow): number | null {
  const start = parsePortfolioDate(order['order_date']);
  const end = parsePortfolioDate(order['delivery_date']);
  if (!start || !end || end.getTime() < start.getTime()) {
    return null;
  }
  return Math.floor((localDay(end).getTime() - localDay(start).getTime()) / 86_400_000);
}

function sumField(rows: PortfolioRow[], field: string): number | null {
  if (rows.length === 0) {
    return 0;
  }
  const amounts = rows.map((row) => toAmount(row[field]));
  return amounts.some((amount) => amount === null)
    ? null
    : amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
}

function sumOptionalField(rows: PortfolioRow[], field: string): number | null {
  const values = rows.map((row) => {
    const value = row[field];
    return value === null || value === undefined || value === ''
      ? 0
      : toAmount(value);
  });
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function sumMachineReadingHours(readings: PortfolioRow[]): number | null {
  const hours = readings.map((reading) => {
    const start = toAmount(reading['start_reading']);
    const end = toAmount(reading['end_reading']);
    if (start === null || end === null || end < start) {
      return null;
    }
    return end - start;
  });

  return hours.some((value) => value === null)
    ? null
    : hours.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function isBilled(value: PortfolioScalar | undefined): boolean {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

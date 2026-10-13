import {
  calculatePortfolioMetrics,
  filterRowsByDate,
  getDeliveryDuration,
  isDieselFuelEntry,
  parsePortfolioDate,
  PortfolioResponse,
} from './portfolio-calculations';

describe('portfolio calculations', () => {
  const portfolio: PortfolioResponse = {
    customer_name: 'Tanvi Chaudhari',
    machine_numbers: ['MH16BH2818'],
    orders: [
      { id: 1, order_date: '05/06/2026', delivery_date: '2026-06-10', advance: '5000' },
      { id: 2, order_date: '11/10/2026', delivery_date: '', advance: null },
    ],
    invoices: [{ id: 'INV-1', billed_date: '11/10/2026', invoice: '<html>175</html>' }],
    payments: [
      { id: 1, payment_date: '05/06/2026', payment: '5000' },
      { id: 2, payment_date: '11/10/2026', payment: '2500' },
    ],
    vehicles: [],
    drivers: [],
    driver_payments: [{ id: 1, payment_date: '11/10/2026', amount: '1500' }],
    vouchers: [{ id: 1, create_date: '11/10/2026', amount: '300' }],
    dumper_trips: [
      { id: 1, create_date: '11/10/2026', is_billed: 'true', total_payment: '1200' },
      { id: 2, create_date: '11/10/2026', is_billed: null, total_payment: '800' },
    ],
    machine_readings: [
      {
        reading_date: '11/10/2026',
        billed: 'true',
        driver_name: 'Driver',
        diesel: '3',
        start_reading: '1000',
        end_reading: '1010',
      },
      {
        reading_date: '11/10/2026',
        billed: null,
        driver_name: null,
        petrol_pump: 'IOCL',
        diesel: '10',
        fuel_rate: '98.2',
      },
    ],
  };

  it('parses ISO and day-first dates and rejects invalid dates', () => {
    expect(parsePortfolioDate('2026-10-11')?.getDate()).toBe(11);
    expect(parsePortfolioDate('11/10/2026')?.getMonth()).toBe(9);
    expect(parsePortfolioDate('31/02/2026')).toBeNull();
  });

  it('filters each event collection by its own event date and avoids deriving unavailable finance', () => {
    const metrics = calculatePortfolioMetrics(portfolio, {
      start: new Date(2026, 9, 1),
      end: new Date(2026, 9, 31),
    });

    expect(metrics.orderCount).toBe(1);
    expect(metrics.orderAdvance).toBeNull();
    expect(metrics.customerPayments).toBe(2500);
    expect(metrics.invoiceCount).toBe(1);
    expect(metrics.driverPaymentVolume).toBe(1500);
    expect(metrics.voucherAmount).toBe(300);
    expect(metrics.billedTrips).toBe(1);
    expect(metrics.unbilledTrips).toBe(1);
    expect(metrics.machineReadingCount).toBe(1);
    expect(metrics.billedReadings).toBe(1);
    expect(metrics.dieselFuelEntries).toBe(1);
    expect(metrics.recordedFuelLiters).toBe(13);
    expect(metrics.totalMachineHours).toBe(10);
    expect(metrics.totalOrderValue).toBe(27000);
    expect(metrics.outstandingBalance).toBe(24500);
    expect(metrics.totalOperationalExpenses).toBeNull();
    expect(metrics.estimatedProfit).toBe(23926);
  });

  it('matches the diesel-entry discriminator and filters rows with their event date', () => {
    const fuel = portfolio.machine_readings[1];
    expect(isDieselFuelEntry(fuel)).toBe(true);
    expect(isDieselFuelEntry(portfolio.machine_readings[0])).toBe(false);
    expect(
      filterRowsByDate(portfolio.payments, 'payment_date', {
        start: new Date(2026, 5, 1),
        end: new Date(2026, 5, 30),
      }),
    ).toHaveLength(1);
  });

  it('totals diesel liters from both machine readings and diesel-only entries', () => {
    const metrics = calculatePortfolioMetrics(
      {
        ...portfolio,
        machine_readings: [
          {
            reading_date: '11/10/2026',
            billed: 'true',
            driver_name: 'Driver',
            diesel: '12.5',
            fuel_rate: '100',
          },
          {
            reading_date: '11/10/2026',
            billed: null,
            driver_name: null,
            petrol_pump: 'IOCL',
            diesel: '8',
            fuel_rate: '100',
          },
        ],
      },
      { start: null, end: null },
    );

    expect(metrics.machineReadingCount).toBe(1);
    expect(metrics.dieselFuelEntries).toBe(1);
    expect(metrics.recordedFuelLiters).toBe(20.5);
  });

  it('treats missing diesel values as zero while summing the other reading entries', () => {
    const metrics = calculatePortfolioMetrics(
      {
        ...portfolio,
        machine_readings: [
          { reading_date: '11/10/2026', driver_name: 'Driver', billed: 'true', diesel: null },
          { reading_date: '11/10/2026', driver_name: null, billed: null, petrol_pump: 'IOCL', diesel: '6' },
        ],
      },
      { start: null, end: null },
    );

    expect(metrics.recordedFuelLiters).toBe(6);
  });

  it('calculates order value from billed and unbilled machine hours and trip totals', () => {
    const metrics = calculatePortfolioMetrics(
      {
        customer_name: 'Tanvi Chaudhari',
        machine_numbers: [],
        orders: [],
        invoices: [],
        payments: [],
        vehicles: [],
        drivers: [],
        driver_payments: [],
        vouchers: [],
        dumper_trips: [
          { total_payment: '100', is_billed: 'true' },
          { total_payment: '300', is_billed: 'false' },
        ],
        machine_readings: [
          {
            start_reading: '100',
            end_reading: '110',
            billed: 'true',
            driver_name: 'Driver',
            diesel: '2',
          },
          {
            start_reading: '200',
            end_reading: '205',
            billed: 'false',
            driver_name: 'Driver',
            diesel: '1',
          },
          {
            start_reading: '500',
            end_reading: '900',
            billed: null,
            driver_name: null,
            petrol_pump: 'IOCL',
            fuel_rate: '98',
            diesel: '90',
          },
        ],
      },
      { start: null, end: null },
    );

    expect(metrics.totalMachineHours).toBe(15);
    expect(metrics.billedReadings).toBe(1);
    expect(metrics.unbilledReadings).toBe(1);
    expect(metrics.recordedFuelLiters).toBe(93);
    expect(metrics.totalOrderValue).toBe(37900);
    expect(metrics.outstandingBalance).toBe(37900);
    expect(metrics.estimatedProfit).toBe(28786);
  });

  it('keeps calculated financial metrics unavailable when machine-hour readings are invalid', () => {
    const metrics = calculatePortfolioMetrics(
      {
        ...portfolio,
        machine_readings: [
          { reading_date: '11/10/2026', billed: true, driver_name: 'Driver', diesel: '4' },
        ],
      },
      { start: null, end: null },
    );

    expect(metrics.totalMachineHours).toBeNull();
    expect(metrics.totalOrderValue).toBeNull();
    expect(metrics.outstandingBalance).toBeNull();
    expect(metrics.estimatedProfit).toBeNull();
  });

  it('calculates delivery duration only for valid order and delivery dates', () => {
    expect(getDeliveryDuration(portfolio.orders[0])).toBe(5);
    expect(getDeliveryDuration(portfolio.orders[1])).toBeNull();
  });
});

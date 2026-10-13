import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';

import { routes } from './app.routes';
import { Host } from './core/services/host';
import { LoginComponent } from './pages/login/login';

describe('App routes', () => {
  const apiUrl = Host.API_URL.replace(/\/+$/, '');
  const chatHistoryKey = 'transport-erp-chat-history';

  afterEach(() => {
    window.localStorage.removeItem(chatHistoryKey);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    }).compileComponents();
  });

  it('should open the login page at the root URL', async () => {
    const harness = await RouterTestingHarness.create();
    const login = await harness.navigateByUrl('/', LoginComponent);

    expect(login).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('.login-page')).not.toBeNull();
  });

  it('should redirect unknown URLs to the login page', async () => {
    const harness = await RouterTestingHarness.create();
    const login = await harness.navigateByUrl('/not-found', LoginComponent);

    expect(login).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('.login-page')).not.toBeNull();
  });

  it('should open the dashboard route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');

    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${apiUrl}/api/customers/dashboard/utilitis`).flush({
      totalOrders: 0,
      totalVehicales: 0,
      activeOrders: 0,
      pendingOrders: 0,
      completeOrders: 0,
      billedTreeps: 0,
      unbilledTreeps: 0,
      diesel: 0,
      totalDivers: 0,
    });
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({
      name: 'Operator',
      mobile: '9370637150',
      bussinessName: 'Transport Company',
    });
    await harness.fixture.whenStable();

    expect(harness.fixture.nativeElement.querySelector('app-dashboard')).not.toBeNull();
    expect(harness.fixture.nativeElement.querySelector('.app-shell')).not.toBeNull();
    expect(harness.fixture.nativeElement.querySelector('.dashboard-page')).not.toBeNull();
    const moduleLinks = Array.from(
      harness.fixture.nativeElement.querySelectorAll('.module-card'),
    ) as HTMLAnchorElement[];
    expect(moduleLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/drivers',
      '/trips',
      '/quotation',
      '/vehicles',
    ]);
  });

  it('should show orders inside the shared layout without loading dashboard statistics', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');

    const dashboardRequest = TestBed.inject(HttpTestingController).expectOne(
      `${apiUrl}/api/customers/dashboard/utilitis`,
    );
    dashboardRequest.flush({
      totalOrders: 0,
      totalVehicales: 0,
      activeOrders: 0,
      pendingOrders: 0,
      completeOrders: 0,
      billedTreeps: 0,
      unbilledTreeps: 0,
      diesel: 0,
      totalDivers: 0,
    });
    TestBed.inject(HttpTestingController)
      .expectOne(`${apiUrl}/api/customers/get`)
      .flush({ name: 'Operator' });
    await harness.fixture.whenStable();
    const appShell = harness.fixture.nativeElement.querySelector('.app-shell');

    await harness.navigateByUrl('/orders');

    TestBed.inject(HttpTestingController)
      .expectOne(`${apiUrl}/api/order/getAll`)
      .flush([]);
    await harness.fixture.whenStable();

    expect(harness.fixture.nativeElement.querySelector('.app-shell')).toBe(appShell);
    expect(harness.fixture.nativeElement.querySelector('app-orders')).not.toBeNull();
    expect(harness.fixture.nativeElement.querySelector('.orders-page')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone(
      `${apiUrl}/api/customers/dashboard/utilitis`,
    );
  });

  it('should open billed machine readings from their route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/machine-reading/billed');

    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll/billed`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({ name: 'Operator' });
    await harness.fixture.whenStable();

    expect(harness.fixture.nativeElement.querySelector('app-billed-reading')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Billed Reading Report');
  });

  it('should open unbilled machine readings from their route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/machine-reading/unbilled');

    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${apiUrl}/vehicle/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/vehicles/getAll`).flush([]);
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({ name: 'Operator' });
    await harness.fixture.whenStable();

    expect(harness.fixture.nativeElement.querySelector('app-unbilled-reading')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Unbilled Machine Reading');
  });

  it('should show account details and log out to the login page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');

    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${apiUrl}/api/customers/dashboard/utilitis`).flush({
      totalOrders: 0,
      totalVehicales: 0,
      activeOrders: 0,
      pendingOrders: 0,
      completeOrders: 0,
      billedTreeps: 0,
      unbilledTreeps: 0,
      diesel: 0,
      totalDivers: 0,
    });
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({
      name: 'Operator',
      mobile: '9370637150',
      bussinessName: 'Transport Company',
    });
    await harness.fixture.whenStable();

    window.localStorage.setItem(chatHistoryKey, JSON.stringify([
      { role: 'user', text: 'Where are my trips?' },
      { role: 'assistant', text: 'This is a saved reply.' },
    ]));

    const profileButton = harness.fixture.nativeElement.querySelector(
      '.profile-toggle',
    ) as HTMLButtonElement;
    profileButton.click();
    harness.detectChanges();

    expect(harness.fixture.nativeElement.textContent).toContain('Transport Company');
    expect(harness.fixture.nativeElement.textContent).toContain('9370637150');

    const logoutButton = harness.fixture.nativeElement.querySelector(
      '.logout-button',
    ) as HTMLButtonElement;
    logoutButton.click();
    await harness.fixture.whenStable();

    expect(harness.fixture.nativeElement.querySelector('.login-page')).not.toBeNull();
    expect(window.localStorage.getItem(chatHistoryKey)).toBeNull();
  });

  it('should show the chat widget and persist user queries with a generic reply', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');

    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${apiUrl}/api/customers/dashboard/utilitis`).flush({
      totalOrders: 0,
      totalVehicales: 0,
      activeOrders: 0,
      pendingOrders: 0,
      completeOrders: 0,
      billedTreeps: 0,
      unbilledTreeps: 0,
      diesel: 0,
      totalDivers: 0,
    });
    httpTesting.expectOne(`${apiUrl}/api/customers/get`).flush({ name: 'Operator' });
    await harness.fixture.whenStable();

    const launcher = harness.fixture.nativeElement.querySelector(
      '.chat-launcher',
    ) as HTMLButtonElement;
    expect(launcher).not.toBeNull();
    launcher.click();
    harness.detectChanges();

    const input = harness.fixture.nativeElement.querySelector(
      '#chat-message',
    ) as HTMLInputElement;
    input.value = 'How many vehicles are active?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    (harness.fixture.nativeElement.querySelector('.chat-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();

    const history = JSON.parse(window.localStorage.getItem(chatHistoryKey) ?? '[]');
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: 'user', text: 'How many vehicles are active?' });
    expect(history[1].role).toBe('assistant');
    expect(history[1].text).toContain('demo assistant');
    expect(harness.fixture.nativeElement.textContent).toContain('How many vehicles are active?');
  });
});

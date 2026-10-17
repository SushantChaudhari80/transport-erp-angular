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
    expect(harness.fixture.nativeElement.querySelector('.login-page')).not.toBeNull();
  });

  it('should load chat sessions and history and send messages to the chat API', async () => {
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

    const sessionsRequest = httpTesting.expectOne(`${apiUrl}/api/rag/chat/sessions`);
    sessionsRequest.flush([
      {
        sessionId: 'older-session',
        lastMessage: 'Older conversation',
        messageCount: 2,
        lastMessageAt: '2026-10-14T10:00:00.000Z',
      },
      {
        sessionId: 'latest-session',
        lastMessage: 'Latest conversation',
        messageCount: 4,
        lastMessageAt: '2026-10-16T10:00:00.000Z',
      },
      {
        sessionId: 'middle-session',
        lastMessage: 'Middle conversation',
        messageCount: 2,
        lastMessageAt: '2026-10-15T10:00:00.000Z',
      },
      {
        sessionId: 'hidden-session',
        lastMessage: 'Not shown in recent sessions',
        messageCount: 2,
        lastMessageAt: '2026-10-13T10:00:00.000Z',
      },
    ]);
    harness.detectChanges();

    const sessionButtons = Array.from(
      harness.fixture.nativeElement.querySelectorAll('.chat-session'),
    ) as HTMLButtonElement[];
    expect(sessionButtons).toHaveLength(4);
    const latestSessionButton = sessionButtons.find((button) =>
      button.textContent?.includes('latest-session'),
    );
    expect(latestSessionButton).toBeDefined();
    latestSessionButton?.click();
    harness.detectChanges();

    const historyRequest = httpTesting.expectOne(
      `${apiUrl}/api/rag/chat/history/latest-session`,
    );
    historyRequest.flush([
      {
        id: 1,
        sessionId: 'latest-session',
        role: 'user',
        message: 'Earlier question',
        createdAt: '2026-10-16T09:00:00.000Z',
      },
      {
        id: 2,
        sessionId: 'latest-session',
        role: 'assistant',
        message: 'Earlier answer',
        createdAt: '2026-10-16T09:00:01.000Z',
      },
    ]);
    harness.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('Earlier question');
    expect(harness.fixture.nativeElement.textContent).toContain('Earlier answer');

    const input = harness.fixture.nativeElement.querySelector(
      '#chat-message',
    ) as HTMLInputElement;
    input.value = 'How many vehicles are active?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    (harness.fixture.nativeElement.querySelector('.chat-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();

    const messageRequest = httpTesting.expectOne(`${apiUrl}/api/rag/chat`);
    expect(messageRequest.request.method).toBe('POST');
    expect(messageRequest.request.body).toEqual({
      sessionId: 'latest-session',
      message: 'How many vehicles are active?',
    });
    messageRequest.flush({
      sessionId: 'latest-session',
      answer:
        'Based on the documents, Transport ERP includes: * **Customer Orders:** Create and maintain customer work records. * **Vehicle Register:** Maintain vehicle records.\n\nIt also supports **reporting** and `<script>alert(1)</script>`.',
      sourceDocuments: [],
      incidentCreated: false,
      incident: null,
    });
    httpTesting.expectOne(`${apiUrl}/api/rag/chat/sessions`).flush([
      {
        sessionId: 'latest-session',
        lastMessage: 'How many vehicles are active?',
        messageCount: 6,
        lastMessageAt: '2026-10-16T10:01:00.000Z',
      },
    ]);
    harness.detectChanges();

    expect(harness.fixture.nativeElement.textContent).toContain(
      'How many vehicles are active?',
    );
    expect(harness.fixture.nativeElement.textContent).toContain(
      'Customer Orders:',
    );
    const assistantMessages = harness.fixture.nativeElement.querySelectorAll(
      '.chat-message-assistant',
    ) as NodeListOf<HTMLElement>;
    const assistantMessage = assistantMessages[assistantMessages.length - 1];
    expect(assistantMessage.querySelectorAll('ul > li')).toHaveLength(2);
    expect(assistantMessage.querySelector('strong')?.textContent).toContain('Customer Orders:');
    expect(assistantMessage.querySelector('p strong')?.textContent).toBe('reporting');
    expect(assistantMessage.querySelector('script')).toBeNull();

    (harness.fixture.nativeElement.querySelector('.chat-new-session') as HTMLButtonElement)
      .click();
    harness.detectChanges();
    expect(harness.fixture.nativeElement.textContent).not.toContain('Earlier question');
    const activeSessionButton = harness.fixture.nativeElement.querySelector(
      '.chat-session-active',
    ) as HTMLButtonElement;
    expect(activeSessionButton).not.toBeNull();
    expect(activeSessionButton.title).toBe('New conversation');
    expect(activeSessionButton.getAttribute('aria-pressed')).toBe('true');

    input.value = 'Start a fresh conversation';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    (harness.fixture.nativeElement.querySelector('.chat-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const newSessionRequest = httpTesting.expectOne(`${apiUrl}/api/rag/chat`);
    expect(newSessionRequest.request.body.sessionId).not.toBe('latest-session');
    expect(newSessionRequest.request.body.message).toBe('Start a fresh conversation');
    newSessionRequest.flush({
      sessionId: newSessionRequest.request.body.sessionId,
      answer: 'Welcome to a new chat.',
      sourceDocuments: [],
      incidentCreated: false,
      incident: null,
    });
    httpTesting.expectOne(`${apiUrl}/api/rag/chat/sessions`).flush([]);
  });
});

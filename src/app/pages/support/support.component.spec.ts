import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupportComponent } from './support.component';

const STORAGE_KEY = 'transport-erp-incidents';

describe('SupportComponent', () => {
  beforeEach(async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [SupportComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('creates and persists incidents with an open status', () => {
    const fixture = TestBed.createComponent(SupportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openCreateForm();
    component.form = {
      title: 'Vehicle assignment fails',
      category: 'Vehicle',
      priority: 'High',
      description: 'The selected vehicle is not being saved on the order.',
    };

    component.createIncident();
    fixture.detectChanges();

    expect(component.incidents).toHaveLength(1);
    expect(component.incidents[0]).toMatchObject({
      title: 'Vehicle assignment fails',
      category: 'Vehicle',
      priority: 'High',
      status: 'Open',
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
    expect(component.showCreateForm).toBe(false);
    expect(component.openCount).toBe(1);
  });

  it('validates required fields before storing an incident', () => {
    const fixture = TestBed.createComponent(SupportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openCreateForm();
    component.form = {
      title: '  ',
      category: 'Vehicle',
      priority: 'Medium',
      description: 'Missing a title.',
    };

    component.createIncident();

    expect(component.errorMessage).toContain('Enter a title and description');
    expect(component.incidents).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('loads existing incidents and persists status updates and filtering', () => {
    const storedIncident = {
      id: 'INC-123',
      title: 'Payment page unavailable',
      category: 'Payment',
      priority: 'Critical',
      status: 'Open',
      description: 'The payment screen returns an error.',
      createdAt: '2026-10-04T01:00:00.000Z',
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([storedIncident]));
    const fixture = TestBed.createComponent(SupportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.incidents).toHaveLength(1);
    component.updateStatus(component.incidents[0], 'In Progress');
    component.statusFilter = 'In Progress';

    expect(component.inProgressCount).toBe(1);
    expect(component.filteredIncidents).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')[0].status)
      .toBe('In Progress');
  });

  it('opens incident details from the incident list', () => {
    const fixture = TestBed.createComponent(SupportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form = {
      title: 'Trip report error',
      category: 'Trip',
      priority: 'Low',
      description: 'Report has stale details.',
    };
    component.createIncident();
    fixture.detectChanges();

    component.openIncident(component.incidents[0]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Report has stale details.');
  });
});

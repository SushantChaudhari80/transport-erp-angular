import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Host } from '../../core/services/host';
import { Incident, IncidentComment } from '../../core/services/incident.service';
import { IncidentManagementComponent } from './incident-management.component';

describe('IncidentManagementComponent', () => {
  let fixture: ComponentFixture<IncidentManagementComponent>;
  let component: IncidentManagementComponent;
  let httpTesting: HttpTestingController;
  const incidentsUrl = `${Host.API_URL.replace(/\/+$/, '')}/api/incidents`;

  const incident: Incident = {
    id: 42,
    incidentCode: 'INC-TANVI0001',
    title: 'Vehicle breakdown',
    category: 'Vehicle',
    priority: 'High',
    status: 'Open',
    description: 'Vehicle broke down during an assigned trip.',
    createdBy: 'Operator',
    createdAt: '2026-11-02T01:55:00Z',
    updatedAt: '2026-11-02T01:55:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentManagementComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(IncidentManagementComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('creates reports as Admin and opens the returned report', () => {
    fixture.detectChanges();
    httpTesting.expectOne(incidentsUrl).flush([]);

    component.draft = {
      title: '  Vehicle breakdown ',
      category: 'Vehicle',
      priority: 'High',
      description: '  Vehicle broke down during an assigned trip. ',
    };
    component.createIncident();

    const createRequest = httpTesting.expectOne(incidentsUrl);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({
      title: 'Vehicle breakdown',
      category: 'Vehicle',
      priority: 'High',
      description: 'Vehicle broke down during an assigned trip.',
      createdBy: 'Admin',
    });
    createRequest.flush(incident);

    httpTesting.expectOne(incidentsUrl).flush([incident]);
    httpTesting.expectOne(`${incidentsUrl}/42`).flush(incident);
    httpTesting.expectOne(`${incidentsUrl}/42/comments`).flush([]);
    expect(component.selectedIncident()).toEqual(incident);
  });

  it('updates status and adds comments to the selected incident', () => {
    component.selectedIncident.set(incident);
    component.changeStatus('In Progress');

    const statusRequest = httpTesting.expectOne(`${incidentsUrl}/42/status`);
    expect(statusRequest.request.body).toEqual({ status: 'In_Progress' });
    statusRequest.flush({ ...incident, status: 'In Progress' });
    expect(component.selectedIncident()?.status).toBe('In Progress');

    component.commentDraft.set('Recovery vehicle dispatched.');
    component.addComment();

    const commentRequest = httpTesting.expectOne(`${incidentsUrl}/42/comments`);
    expect(commentRequest.request.body).toEqual({
      comment: 'Recovery vehicle dispatched.',
      commentedBy: 'Admin',
    });
    const comment: IncidentComment = {
      id: 17,
      incidentId: 42,
      commentText: 'Recovery vehicle dispatched.',
      commentedBy: 'Admin',
      createdAt: '2026-11-02T02:05:00Z',
    };
    commentRequest.flush(comment);
    expect(component.comments()).toEqual([comment]);
  });
});

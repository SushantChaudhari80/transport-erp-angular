import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Host } from './host';
import { IncidentService } from './incident.service';

describe('IncidentService', () => {
  let service: IncidentService;
  let httpTesting: HttpTestingController;
  const incidentsUrl = `${Host.API_URL.replace(/\/+$/, '')}/api/incidents`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(IncidentService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists incidents', () => {
    service.listIncidents().subscribe((incidents) => expect(incidents).toEqual([]));

    const request = httpTesting.expectOne(incidentsUrl);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('creates an incident', () => {
    const body = {
      title: 'Vehicle breakdown',
      category: 'Vehicle' as const,
      priority: 'High' as const,
      createdBy: 'Admin',
      description: 'Vehicle broke down during an assigned trip.',
    };

    service.createIncident(body).subscribe();

    const request = httpTesting.expectOne(incidentsUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({});
  });

  it('loads incident details and comments', () => {
    service.getIncident(42).subscribe();
    const detailsRequest = httpTesting.expectOne(`${incidentsUrl}/42`);
    expect(detailsRequest.request.method).toBe('GET');
    detailsRequest.flush({});

    service.listComments(42).subscribe();
    const commentsRequest = httpTesting.expectOne(`${incidentsUrl}/42/comments`);
    expect(commentsRequest.request.method).toBe('GET');
    commentsRequest.flush([]);
  });

  it('updates status using the API enum and posts comments as Admin', () => {
    service.updateIncidentStatus(42, 'In_Progress').subscribe();
    const statusRequest = httpTesting.expectOne(`${incidentsUrl}/42/status`);
    expect(statusRequest.request.method).toBe('PATCH');
    expect(statusRequest.request.body).toEqual({ status: 'In_Progress' });
    statusRequest.flush({});

    service.addComment(42, 'Recovery vehicle has been dispatched.').subscribe();
    const commentRequest = httpTesting.expectOne(`${incidentsUrl}/42/comments`);
    expect(commentRequest.request.method).toBe('POST');
    expect(commentRequest.request.body).toEqual({
      comment: 'Recovery vehicle has been dispatched.',
      commentedBy: 'Admin',
    });
    commentRequest.flush({});
  });
});

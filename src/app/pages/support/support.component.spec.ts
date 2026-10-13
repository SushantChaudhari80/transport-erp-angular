import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Host } from '../../core/services/host';
import { SupportComponent } from './support.component';

const INCIDENTS_URL = `${Host.API_URL.replace(/\/+$/, '')}/api/incidents`;

const recentIncident = {
  id: 2,
  incidentCode: 'INC-TANVI0002',
  title: 'Payment page unavailable',
  category: 'Payment',
  priority: 'Critical',
  status: 'Open',
  description: 'The payment screen returns an error.',
  createdBy: 'Admin',
  createdAt: '2026-10-05T01:00:00.000Z',
  updatedAt: '2026-10-05T01:00:00.000Z',
};

const olderIncident = {
  id: 1,
  incidentCode: 'INC-TANVI0001',
  title: 'Vehicle assignment fails',
  category: 'Vehicle',
  priority: 'High',
  status: 'In Progress',
  description: 'The selected vehicle is not being saved on the order.',
  createdBy: 'Web UI User',
  createdAt: '2026-10-04T01:00:00.000Z',
  updatedAt: '2026-10-04T01:00:00.000Z',
};

describe('SupportComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createLoadedComponent() {
    const fixture = TestBed.createComponent(SupportComponent);
    fixture.detectChanges();
    httpTesting.expectOne(INCIDENTS_URL).flush([olderIncident, recentIncident]);
    fixture.detectChanges();
    return fixture;
  }

  it('loads incidents ordered newest first and calculates status counts', () => {
    const fixture = createLoadedComponent();
    const component = fixture.componentInstance;

    expect(component.incidents.map((incident) => incident.id)).toEqual([2, 1]);
    expect(component.openCount).toBe(1);
    expect(component.inProgressCount).toBe(1);
    expect(component.resolvedCount).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Created By');
    expect(fixture.nativeElement.textContent).toContain('Admin');
    expect(fixture.nativeElement.textContent).toContain('Web UI User');
  });

  it('creates an incident using the backend request contract', () => {
    const fixture = createLoadedComponent();
    const component = fixture.componentInstance;
    component.form = {
      title: '  New trip issue  ',
      category: 'Trip',
      priority: 'High',
      description: '  The trip details are incorrect.  ',
    };

    component.createIncident();

    const request = httpTesting.expectOne(INCIDENTS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      title: 'New trip issue',
      category: 'Trip',
      priority: 'High',
      createdBy: 'Web UI User',
      description: 'The trip details are incorrect.',
    });
    request.flush({
      id: 3,
      incidentCode: 'INC-TANVI0003',
      ...request.request.body,
      status: 'Open',
      createdAt: '2026-10-06T01:00:00.000Z',
      updatedAt: '2026-10-06T01:00:00.000Z',
    });

    expect(component.incidents[0].id).toBe(3);
    expect(component.showCreateForm).toBe(false);
    expect(component.successMessage).toContain('created successfully');
  });

  it('updates incident status without changing the incident details', () => {
    const fixture = createLoadedComponent();
    const component = fixture.componentInstance;
    const incident = component.incidents[0];
    component.updateStatus(incident, 'In Progress');

    const request = httpTesting.expectOne(`${INCIDENTS_URL}/2/status`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'In_Progress' });
    request.flush({ ...recentIncident, status: 'In Progress' });

    expect(component.incidents[0]).toMatchObject({
      id: 2,
      title: recentIncident.title,
      description: recentIncident.description,
      status: 'In Progress',
    });
  });

  it('loads comments oldest first and scrolls to the latest appended comment', async () => {
    const fixture = createLoadedComponent();
    const component = fixture.componentInstance;
    component.openIncident(component.incidents[0]);

    const getComments = httpTesting.expectOne(`${INCIDENTS_URL}/2/comments`);
    expect(getComments.request.method).toBe('GET');
    getComments.flush([
      {
        id: 3,
        incidentId: 2,
        commentText: 'Problem is not resolved yet.',
        commentedBy: 'Web UI user',
        createdAt: '2026-10-05T02:00:00.000Z',
      },
      {
        id: 4,
        incidentId: 2,
        commentText: 'Dev team is working on it.',
        commentedBy: 'Admin',
        createdAt: '2026-10-05T04:00:00.000Z',
      },
    ]);
    expect(component.incidentComments.map((comment) => comment.id)).toEqual([3, 4]);
    expect(component.isUserComment(component.incidentComments[0])).toBe(true);
    expect(component.isUserComment(component.incidentComments[1])).toBe(false);

    fixture.detectChanges();
    const commentList = fixture.nativeElement.querySelector('.comment-list') as HTMLOListElement;
    Object.defineProperty(commentList, 'scrollHeight', { configurable: true, value: 500 });

    component.commentDraft = '  Please share an update.  ';
    component.addComment();
    const postComment = httpTesting.expectOne(`${INCIDENTS_URL}/2/comments`);
    expect(postComment.request.method).toBe('POST');
    expect(postComment.request.body).toEqual({
      comment: 'Please share an update.',
      commentedBy: 'Web UI User',
    });
    postComment.flush({
      id: 5,
      incidentId: 2,
      commentText: 'Please share an update.',
      commentedBy: 'Web UI User',
      createdAt: '2026-10-05T05:00:00.000Z',
    });

    expect(component.incidentComments.map((comment) => comment.id)).toEqual([3, 4, 5]);
    expect(component.incidentComments.map((comment) => comment.commentText)).toEqual([
      'Problem is not resolved yet.',
      'Dev team is working on it.',
      'Please share an update.',
    ]);
    expect(component.commentDraft).toBe('');
    fixture.detectChanges();
    await fixture.whenStable();
    const displayedComments = fixture.nativeElement.querySelectorAll('.comment-item');
    expect(displayedComments).toHaveLength(3);
    expect(displayedComments[0].classList.contains('comment-user')).toBe(true);
    expect(displayedComments[1].classList.contains('comment-user')).toBe(false);
    expect(displayedComments[2].classList.contains('comment-user')).toBe(true);
    expect(commentList.scrollTop).toBe(500);
    expect(fixture.nativeElement.querySelector('.comment-edit')).toBeNull();
  });

  it('rejects invalid incident input without making an API request', () => {
    const fixture = createLoadedComponent();
    const component = fixture.componentInstance;
    component.form = {
      title: '  ',
      category: 'Vehicle',
      priority: 'Medium',
      description: 'Missing a title.',
    };

    component.createIncident();

    expect(component.errorMessage).toContain('valid incident details');
    httpTesting.expectNone(INCIDENTS_URL);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LoginComponent } from './login';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpTesting: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should report missing credentials', () => {
    component.login();

    expect(component.error).toBe('Please enter username and password.');
  });

  it('should call the login API and navigate on success', () => {
    component.username = 'operator@example.com';
    component.password = 'test@123';

    component.login();

    const request = httpTesting.expectOne(
      (req) =>
        req.url === 'http://localhost:8081/login/user' &&
        req.params.get('email') === 'operator@example.com' &&
        req.params.get('pass') === 'test@123',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ message: 'success' });

    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.error).toBe('');
    expect(component.loading).toBe(false);
  });

  it('should show an authentication error when the API rejects the credentials', () => {
    component.username = 'operator@example.com';
    component.password = 'wrong-password';

    component.login();
    httpTesting.expectOne((req) => req.url.endsWith('/login/user')).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(component.error).toBe('Invalid username or password.');
    expect(component.loading).toBe(false);
  });
});

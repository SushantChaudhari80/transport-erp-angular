import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Host } from './host';

export interface LoginResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly http = inject(HttpClient);

  login(email: string, password: string): Observable<LoginResponse> {

    const params = new HttpParams()
      .set('email', email)
      .set('pass', password);

    return this.http.get<LoginResponse>(
      `${Host.API_URL}login/user`,
      { params }
    );
  }
}
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Host } from './host';

export interface ChatSession {
  sessionId: string;
  lastMessage: string;
  messageCount: number;
  lastMessageAt: string;
}

export interface ChatHistoryEntry {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant';
  message: string;
  createdAt: string;
}

export interface ChatResponse {
  sessionId: string;
  answer: string;
  sourceDocuments: string[];
  incidentCreated: boolean;
  incident: ChatIncident | null;
}

export interface ChatIncident {
  id: number;
  incidentCode: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdBy: string;
}

export interface DocumentUploadResponse {
  message: string;
  documentName: string;
  chunksStored: number;
}

export interface DocumentDeleteResponse {
  message: string;
  documentName: string;
  chunksDeleted: number;
}

export interface ClearHistoryResponse {
  message: string;
  sessionId: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly chatUrl = `${Host.API_URL}api/rag/chat`;
  private readonly documentsUrl = `${Host.API_URL}api/rag/documents`;

  getSessions(): Observable<ChatSession[]> {
    return this.http.get<ChatSession[]>(`${this.chatUrl}/sessions`);
  }

  getHistory(sessionId: string): Observable<ChatHistoryEntry[]> {
    return this.http.get<ChatHistoryEntry[]>(
      `${this.chatUrl}/history/${encodeURIComponent(sessionId)}`,
    );
  }

  sendMessage(sessionId: string, message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(this.chatUrl, { sessionId, message });
  }

  getDocuments(): Observable<string[]> {
    return this.http.get<string[]>(this.documentsUrl);
  }

  uploadDocument(file: File): Observable<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DocumentUploadResponse>(this.documentsUrl, formData);
  }

  deleteDocument(documentName: string): Observable<DocumentDeleteResponse> {
    return this.http.delete<DocumentDeleteResponse>(
      `${this.documentsUrl}/${encodeURIComponent(documentName)}`,
    );
  }

  clearHistory(sessionId: string): Observable<ClearHistoryResponse> {
    return this.http.delete<ClearHistoryResponse>(
      `${this.chatUrl}/history/${encodeURIComponent(sessionId)}`,
    );
  }
}

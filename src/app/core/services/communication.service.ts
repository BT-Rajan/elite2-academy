import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  CommEventCatalogEntry, CommTemplate, CommLog, CommCampaign, CommProviderConfig,
} from '../models';

// ─────────────────────────────────────────────────────────────────────────────
//  CommunicationService — the Communication Layer's API surface: event
//  catalog, templates (incl. JSON import/export), single/bulk sends,
//  campaigns (Email Campaigns / Newsletters / Promotions), OTP, and
//  per-channel provider configuration. Doesn't extend BaseHttpService since
//  there's no single "the" resource here — several sub-resources instead.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private api = inject(ApiService);

  // ApiService.get() sets every key verbatim via URLSearchParams — an
  // `undefined` value would literally become the string "undefined" in the
  // query string (a real, silent filter bug), so every optional-filter
  // caller below runs through this first.
  private cleanParams(params?: Record<string, any>): Record<string, string> | undefined {
    if (!params) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') out[k] = String(v);
    return out;
  }

  eventTypes$(): Observable<CommEventCatalogEntry[]> {
    return this.api.get<{ data: CommEventCatalogEntry[] }>('/communication/event-types').pipe(map(r => r.data));
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  templates$(filter?: { eventType?: string; channel?: string }): Observable<CommTemplate[]> {
    return this.api.get<{ data: CommTemplate[] }>('/communication/templates', this.cleanParams(filter)).pipe(map(r => r.data));
  }
  async createTemplate(t: Partial<CommTemplate>): Promise<CommTemplate> {
    const res = await this.api.post<{ data: CommTemplate }>('/communication/templates', t).toPromise();
    return res!.data;
  }
  async updateTemplate(id: string, t: Partial<CommTemplate>): Promise<CommTemplate> {
    const res = await this.api.patch<{ data: CommTemplate }>(`/communication/templates/${id}`, t).toPromise();
    return res!.data;
  }
  async deleteTemplate(id: string): Promise<void> {
    await this.api.delete(`/communication/templates/${id}`).toPromise();
  }
  async importTemplates(templates: Partial<CommTemplate>[]): Promise<{ imported: number; updated: number; total: number }> {
    const res = await this.api.post<{ data: any }>('/communication/templates/import', { templates }).toPromise();
    return res!.data;
  }
  async exportTemplates(): Promise<{ templates: Partial<CommTemplate>[] }> {
    const res = await this.api.get<{ data: { templates: Partial<CommTemplate>[] } }>('/communication/templates/export').toPromise();
    return res!.data;
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  async send(payload: Record<string, any>): Promise<{ logId: string; status: string; error?: string }> {
    const res = await this.api.post<{ data: any }>('/communication/send', payload).toPromise();
    return res!.data;
  }
  async sendBulk(payload: Record<string, any>): Promise<{ total: number; sent: number; failed: number; results: any[] }> {
    const res = await this.api.post<{ data: any }>('/communication/send/bulk', payload).toPromise();
    return res!.data;
  }

  // ── History ────────────────────────────────────────────────────────────────
  logs$(filter?: { eventType?: string; channel?: string; status?: string; limit?: string }): Observable<CommLog[]> {
    return this.api.get<{ data: CommLog[] }>('/communication/logs', this.cleanParams(filter)).pipe(map(r => r.data));
  }
  log$(id: string): Observable<CommLog> {
    return this.api.get<{ data: CommLog }>(`/communication/logs/${id}`).pipe(map(r => r.data));
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────
  campaigns$(filter?: { type?: string; status?: string }): Observable<CommCampaign[]> {
    return this.api.get<{ data: CommCampaign[] }>('/communication/campaigns', this.cleanParams(filter)).pipe(map(r => r.data));
  }
  campaign$(id: string): Observable<CommCampaign> {
    return this.api.get<{ data: CommCampaign }>(`/communication/campaigns/${id}`).pipe(map(r => r.data));
  }
  async createCampaign(c: Partial<CommCampaign>): Promise<CommCampaign> {
    const res = await this.api.post<{ data: CommCampaign }>('/communication/campaigns', c).toPromise();
    return res!.data;
  }
  async sendCampaign(id: string): Promise<CommCampaign> {
    const res = await this.api.post<{ data: CommCampaign }>(`/communication/campaigns/${id}/send`, {}).toPromise();
    return res!.data;
  }
  async deleteCampaign(id: string): Promise<void> {
    await this.api.delete(`/communication/campaigns/${id}`).toPromise();
  }

  // ── OTP (SMS only) ─────────────────────────────────────────────────────────
  async sendOtp(phone: string, purpose?: string): Promise<{ sent: boolean; expiresInSeconds: number }> {
    const res = await this.api.post<{ data: any }>('/communication/otp/send', { phone, purpose }).toPromise();
    return res!.data;
  }
  async verifyOtp(phone: string, code: string, purpose?: string): Promise<{ verified: boolean }> {
    const res = await this.api.post<{ data: any }>('/communication/otp/verify', { phone, code, purpose }).toPromise();
    return res!.data;
  }

  // ── Provider configuration (Admin only) ───────────────────────────────────
  providers$(): Observable<CommProviderConfig[]> {
    return this.api.get<{ data: CommProviderConfig[] }>('/communication/providers').pipe(map(r => r.data));
  }
  async updateProvider(channel: string, provider: string, config: Record<string, string>): Promise<void> {
    await this.api.patch(`/communication/providers/${channel}`, { provider, config }).toPromise();
  }
}

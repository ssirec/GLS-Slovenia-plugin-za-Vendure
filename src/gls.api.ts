import crypto from 'crypto';
import fetch from 'node-fetch';
import { GlsPlugin } from './gls.plugin';

export class GlsApiClient {
  private baseUrl: string;

  constructor() {
    const country = GlsPlugin.options.country;
    this.baseUrl = `https://api.mygls.${country}/ParcelService.svc/json`;
  }

  private sha512(password: string): Buffer {
    return crypto.createHash('sha512').update(password).digest();
  }

  private get auth() {
    return {
      Username: GlsPlugin.options.username,
      Password: Array.from(this.sha512(GlsPlugin.options.password)),
      ClientNumberList: [GlsPlugin.options.clientNumber],
      WebshopEngine: GlsPlugin.options.webshopEngine ?? 'Vendure',
    };
  }

  async printLabels(parcelList: any[]) {
    const body = {
      ...this.auth,
      ParcelList: parcelList,
      TypeOfPrinter: GlsPlugin.options.printerType ?? 'A4_2x2',
      ShowPrintDialog: false,
    };

    const response = await fetch(`${this.baseUrl}/PrintLabels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`GLS API error: ${response.status}`);
    }

    return response.json();
  }
}

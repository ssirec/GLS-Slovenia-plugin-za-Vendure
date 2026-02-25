import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { GlsService } from './gls.service';

export interface GlsPluginOptions {
  username: string;
  password: string; // plain text, SHA512 se naredi interno
  clientNumber: number;
  country: 'si' | 'hr' | 'hu' | 'cz' | 'sk' | 'ro' | 'rs';
  printerType?: string;
  webshopEngine?: string;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [GlsService],
})
export class GlsPlugin {
  static options: GlsPluginOptions;

  static init(options: GlsPluginOptions) {
    this.options = options;
    return GlsPlugin;
  }
}

# Vendure plugins template

This repo is a starter for creating shared Vendure plugins for distribution via NPM 
or any other package manager.

## Structure

This is a monorepo powered by [Lerna](https://lerna.js.org/). The folder structure is as follows:

```
packages/           # Each plugin is housed in a directory under `packages`
  example-plugin/   # An example plugin to get you started
    dev-server/     # The development server for testing the plugin
    e2e/            # End-to-end tests for the plugin
    src/            # The source code of the plugin  
utils/              # Utility scripts for shared tasks
    e2e/            # Helper functions for e2e tests
```

The reason we are using a monorepo is that it allows you to create multiple plugins without requiring a separate 
repository for each one. This reduces the maintenance burden and makes it easier to manage multiple plugins.

## Getting started

1. Clone this repository
2. Run `npm install` from the root to install the dependencies
3. `cd packages/example-plugin`
4. Run `npm run dev` to start the development server for the example plugin.
5. Modify the example plugin to implement your features.

## Code generation

This repo is set up with [GraphQL Code Generator](https://www.graphql-code-generator.com/) to generate TypeScript types
for the schema extensions in your plugins. To generate the types, run `npm run generate` from the plugin directory:

```bash
cd packages/example-plugin
npm run codegen
```

This should be done whenever you:

- make changes to the schema extensions in your plugin (`/src/api/api-extensions.ts`)
- make changes to GraphQL queries or mutations in your e2e tests (in `/e2e/graphql/**.ts`)
- make changes to the GraphQL queries or mutations in your plugin's admin UI (in `/src/ui/**.ts`)

## Testing

End-to-end (e2e) tests are run using `npm run e2e` from the plugin directory. This will start a Vendure server with the
plugin installed, run the tests in the `e2e` directory, and then shut down the server.

```bash
cd packages/example-plugin
npm run e2e
```

## Publishing to NPM

1. Go to the directory of the plugin you want to publish, e.g. `cd packages/example-plugin`
2. `npm run build`
3. `npm publish`


GLS plugin za Vendure, zasnovan na uradnem Vendure monorepo plugin template in MyGLS REST API (JSON). Implementacija uporablja PrintLabels endpoint (ker združuje PrepareLabels + GetPrintedLabels v enem klicu).

Cilj:

ShippingMethod handler za GLS

Service za komunikacijo z MyGLS REST API

Konfiguracija (username, password, clientNumber, countryDomain, printerType)

Kreiranje label ob OrderStateTransition (npr. ko gre v Shipped)

Shramba GLS ParcelNumber + PDF label v Asset ali custom field

1️⃣ Arhitektura

Plugin vsebuje:

packages/vendure-plugin-gls/
 ├─ src/
 │   ├─ gls.plugin.ts
 │   ├─ gls.service.ts
 │   ├─ gls.api.ts
 │   ├─ gls.types.ts
 │   ├─ gls.constants.ts
 │   ├─ gls.shipping-handler.ts
 │   └─ index.ts
 ├─ package.json
 └─ tsconfig.json
2️⃣ Plugin konfiguracija
// gls.plugin.ts

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
3️⃣ GLS API client (REST JSON)

MyGLS zahteva:

SHA512 password → byte array

POST https://api.mygls.{country}/ParcelService.svc/json/PrintLabels

// gls.api.ts

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
4️⃣ Mapiranje Vendure Order → GLS Parcel
// gls.service.ts

import { Injectable } from '@nestjs/common';
import { Order } from '@vendure/core';
import { GlsApiClient } from './gls.api';
import { GlsPlugin } from './gls.plugin';

@Injectable()
export class GlsService {
  private api = new GlsApiClient();

  async createShipment(order: Order) {
    const shippingAddress = order.shippingAddress;

    const parcel = {
      ClientNumber: GlsPlugin.options.clientNumber,
      ClientReference: order.code,
      Count: 1,
      Content: 'Webshop order',
      PickupDate: new Date().toISOString(),
      PickupAddress: this.getPickupAddress(),
      DeliveryAddress: {
        Name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        Street: shippingAddress.streetLine1,
        HouseNumber: '1',
        City: shippingAddress.city,
        ZipCode: shippingAddress.postalCode,
        CountryIsoCode: shippingAddress.countryCode,
        ContactEmail: shippingAddress.emailAddress,
        ContactPhone: shippingAddress.phoneNumber,
      },
      ServiceList: [],
    };

    const result = await this.api.printLabels([parcel]);

    if (result.PrintLabelsErrorList?.length) {
      throw new Error(JSON.stringify(result.PrintLabelsErrorList));
    }

    return result;
  }

  private getPickupAddress() {
    return {
      Name: 'Your Company d.o.o.',
      Street: 'Main street',
      HouseNumber: '1',
      City: 'Ljubljana',
      ZipCode: '1000',
      CountryIsoCode: 'SI',
    };
  }
}
5️⃣ ShippingMethod handler
// gls.shipping-handler.ts

import { ShippingEligibilityChecker } from '@vendure/core';

export const glsEligibilityChecker = new ShippingEligibilityChecker({
  code: 'gls-shipping',
  description: [{ languageCode: 'sl', value: 'GLS dostava' }],
  check: async () => true,
});

V vendure-config.ts:

GlsPlugin.init({
  username: process.env.GLS_USER!,
  password: process.env.GLS_PASS!,
  clientNumber: Number(process.env.GLS_CLIENT),
  country: 'si',
  printerType: 'A4_2x2',
}),
6️⃣ Hook: avtomatsko generiranje label ob Shipped
import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, OrderStateTransitionEvent } from '@vendure/core';

export class GlsService implements OnApplicationBootstrap {

  constructor(private eventBus: EventBus) {}

  onApplicationBootstrap() {
    this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async event => {
      if (event.toState === 'Shipped') {
        await this.createShipment(event.order);
      }
    });
  }
}
7️⃣ Podprte funkcije (roadmap)

Plugin lahko razširiš z:

✅ GetParcelStatuses → tracking

✅ DeleteLabels → cancel shipment

✅ ModifyCOD

✅ PSD (ParcelShop Delivery)

✅ LRS (LockerReturn)

✅ PIN podpora (PrintLabels_20251022)

8️⃣ Produkcijska priporočila

Retry protection (GLS error 31)

Rate limiting

Persist GLS ParcelNumber v custom field

Persist Label PDF kot Vendure Asset

Multi-channel support

Country auto-routing

9️⃣ Publish plugin

Uporabi:

npm run build

npm publish

sledi uradnemu publish vodiču Vendure
For an in-depth guide on publishing to NPM and the Vendure Hub,
see our [Publishing a Plugin guide](https://docs.vendure.io/guides/how-to/publish-plugin/).


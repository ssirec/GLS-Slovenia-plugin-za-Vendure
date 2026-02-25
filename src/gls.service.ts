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

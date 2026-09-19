export type CustomerServiceContact = {
  whatsappNumber: string;
  whatsappHref: string;
  playStoreHref: string | null;
  facebookLabel: string;
  facebookHref: string;
  phoneNumber: string;
  phoneHref: string;
};

export interface CustomerServiceProvider {
  getContact: () => CustomerServiceContact;
}

// Coordonnées de démonstration en attendant la configuration du panel.
const fictionalCustomerServiceContact: CustomerServiceContact = {
  whatsappNumber: '+225 07 00 00 00 00',
  whatsappHref: 'https://wa.me/2250700000000',
  playStoreHref: null,
  facebookLabel: 'facebook.com/SendFlow',
  facebookHref: 'https://www.facebook.com/SendFlow',
  phoneNumber: '+225 07 00 00 00 00',
  phoneHref: 'tel:+2250700000000',
};

export const customerServiceProvider: CustomerServiceProvider = {
  getContact: () => fictionalCustomerServiceContact,
};
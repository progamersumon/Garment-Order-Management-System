export interface Order {
  id?: number;
  contractNo: string;
  poNo: string;
  item: string;
  buyer: string;
  styleName: string;
  color: string;
  season: string;
  orderQty: number;
  washPricePcs: number;
  washPriceDoz: number;
  shipmentDate: string;
}

export interface WashPrice {
  id?: number;
  buyer: string;
  description: string;
  styleName: string;
  color: string;
  season: string;
  washPricePcs: number;
  washPriceDoz: number;
}

export const BUYERS = [
  "Dashboard",
  "Buyers",
  "H&M",
  "Mango",
  "Stradivarius",
  "Jules",
  "Benetton",
  "GDM",
  "Zara",
];

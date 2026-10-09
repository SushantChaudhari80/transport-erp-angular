export interface DashboardStats {
  totalOrders: number;
  totalVehicales: number;
  activeOrders: number;
  pendingOrders: number;
  completeOrders: number;
  billedTreeps: number;
  unbilledTreeps: number;
  diesel: number;
  totalDivers: number;
}

export interface Customer {
  name?: string;
  picture?: string;

  mobile?: string;
  bussinessName?: string;
  gstNo?: string;
  acNo?: string;
  ifsc?: string;
  bankName?: string;
  address?: string;
}   
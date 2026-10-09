export interface VehicleOption {
  id: number | string;
  machine_number?: string;
  machineNumber?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

export function parseVehicleOptions(response: unknown): VehicleOption[] | null {
  if (!Array.isArray(response)) {
    return null;
  }

  const vehicles: VehicleOption[] = [];
  for (const item of response) {
    if (
      !isRecord(item) ||
      (typeof item['vehicle_id'] !== 'number' &&
        typeof item['vehicle_id'] !== 'string' &&
        typeof item['id'] !== 'number' &&
        typeof item['id'] !== 'string') ||
      !isOptionalString(item['machine_number']) ||
      !isOptionalString(item['machineNumber'])
    ) {
      return null;
    }

    const id = item['vehicle_id'] ?? item['id'];
    if (typeof id !== 'number' && typeof id !== 'string') {
      return null;
    }
    const machineNumber =
      (typeof item['machine_number'] === 'string' && item['machine_number']) ||
      (typeof item['machineNumber'] === 'string' && item['machineNumber']) ||
      undefined;

    vehicles.push({
      id,
      machine_number: machineNumber,
      machineNumber,
    });
  }

  return vehicles;
}

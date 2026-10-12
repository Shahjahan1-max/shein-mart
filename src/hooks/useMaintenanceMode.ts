import { useSettings } from "./useApi";

export function useMaintenanceMode(): boolean {
  const { data } = useSettings<{ maintenanceMode?: boolean }>();
  return Boolean(data?.maintenanceMode);
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as backend from "../lib/backend";

const DB_QUERY_KEY = ["gymsphere-db"] as const;

export function useDb() {
  return useQuery({
    queryKey: DB_QUERY_KEY,
    queryFn: () => backend.refreshDb(),
    staleTime: 0,
  });
}

export function useInvalidateDb() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: DB_QUERY_KEY });
}

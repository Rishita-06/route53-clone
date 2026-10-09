export type RecordType = "A" | "AAAA" | "CAA" | "CNAME" | "MX" | "NS" | "PTR" | "SOA" | "SRV" | "TXT";
export type RoutingPolicy = "Simple" | "Weighted";

export interface User { id: number; account_id: string; username: string; display_name: string }

export interface HostedZone {
  id: string; name: string; comment: string; is_private: boolean;
  vpc_id: string | null; vpc_region: string | null; tags: Record<string, string>;
  created_by: string; created_at: string; record_count: number;
}

export interface AliasTarget { dns_name: string; evaluate_target_health: boolean; hosted_zone_id?: string | null }

export interface DnsRecord {
  id: number; zone_id: string; name: string; type: RecordType; ttl: number | null; values: string[];
  alias_target: AliasTarget | null; routing_policy: RoutingPolicy; set_identifier: string;
  weight: number | null; protected: boolean; created_at: string; updated_at: string;
}

export interface RecordInput {
  name: string; type: RecordType; ttl: number | null; values: string[];
  alias_target: AliasTarget | null; routing_policy: RoutingPolicy; set_identifier: string; weight: number | null;
}

export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface ImportResult { created: number; updated: number; skipped: number; errors: string[] }

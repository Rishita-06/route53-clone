import type { SideNavigationProps } from "@cloudscape-design/components/side-navigation";

/** Placeholder ("Coming soon") pages, keyed by URL slug. */
export const MOCK_PAGES: Record<string, string> = {
  dashboard: "Dashboard",
  "health-checks": "Health checks",
  "cidr-collections": "CIDR collections",
  "traffic-policies": "Traffic policies",
  "policy-records": "Policy records",
  "registered-domains": "Registered domains",
  "domain-requests": "Pending requests",
  profiles: "Profiles",
  "resolver-vpcs": "VPCs",
  "inbound-endpoints": "Inbound endpoints",
  "outbound-endpoints": "Outbound endpoints",
  "resolver-rules": "Rules",
  "resolver-query-logging": "Query logging",
  "dns-firewall-rule-groups": "Rule groups",
  "dns-firewall-domain-lists": "Domain lists",
};

const L = (slug: string): SideNavigationProps.Link => ({ type: "link", text: MOCK_PAGES[slug], href: `/${slug}` });

export const NAV_ITEMS: SideNavigationProps.Item[] = [
  L("dashboard"),
  { type: "link", text: "Hosted zones", href: "/hosted-zones" },
  L("health-checks"),
  { type: "section", text: "IP-based routing", defaultExpanded: false, items: [L("cidr-collections")] },
  { type: "section", text: "Traffic flow", defaultExpanded: false, items: [L("traffic-policies"), L("policy-records")] },
  { type: "section", text: "Domains", defaultExpanded: false, items: [L("registered-domains"), L("domain-requests")] },
  L("profiles"),
  {
    type: "section", text: "Resolver", defaultExpanded: false,
    items: [L("resolver-vpcs"), L("inbound-endpoints"), L("outbound-endpoints"), L("resolver-rules"), L("resolver-query-logging")],
  },
  { type: "section", text: "DNS Firewall", defaultExpanded: false, items: [L("dns-firewall-rule-groups"), L("dns-firewall-domain-lists")] },
];

"use client";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { DnsRecord, HostedZone, RecordType, RoutingPolicy } from "@/lib/types";

const TYPE_INFO: { value: RecordType; desc: string; placeholder: string }[] = [
  { value: "A", desc: "Routes traffic to an IPv4 address and some AWS resources", placeholder: "192.0.2.235" },
  { value: "AAAA", desc: "Routes traffic to an IPv6 address and some AWS resources", placeholder: "2001:0db8:85a3:0:0:8a2e:0370:7334" },
  { value: "CAA", desc: "Restricts CAs that can create SSL/TLS certifications for the domain", placeholder: '0 issue "ca.example.net"' },
  { value: "CNAME", desc: "Routes traffic to another domain name and to some AWS resources", placeholder: "www.example.com" },
  { value: "MX", desc: "Routes traffic to mail servers", placeholder: "10 mail.example.com" },
  { value: "NS", desc: "Identifies the name servers for the hosted zone", placeholder: "ns-1.example.org" },
  { value: "PTR", desc: "Maps an IP address to a domain name", placeholder: "www.example.com" },
  { value: "SRV", desc: "Application-specific values that identify servers", placeholder: "1 10 5269 xmpp-server.example.com" },
  { value: "TXT", desc: "Used to verify email senders and for application-specific values", placeholder: '"Sample text"' },
];
const TYPE_OPTIONS = TYPE_INFO.map((t) => ({ label: t.value, value: t.value, description: t.desc }));
const ROUTING_OPTIONS = [
  { label: "Simple routing", value: "Simple" }, { label: "Weighted", value: "Weighted" },
  { label: "Geolocation (coming soon)", value: "geo", disabled: true }, { label: "Latency (coming soon)", value: "latency", disabled: true },
  { label: "Failover (coming soon)", value: "failover", disabled: true },
];

export function RecordForm({ zone, record }: { zone: HostedZone; record?: DnsRecord }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const editing = !!record;
  const sub = record ? (record.name === zone.name ? "" : record.name.slice(0, -(zone.name.length + 1))) : "";

  const [name, setName] = useState(sub);
  const [type, setType] = useState(TYPE_OPTIONS.find((o) => o.value === (record?.type ?? "A")) ?? TYPE_OPTIONS[0]);
  const [alias, setAlias] = useState(!!record?.alias_target);
  const [values, setValues] = useState(record?.values.join("\n") ?? "");
  const [ttl, setTtl] = useState(String(record?.ttl ?? 300));
  const [aliasDns, setAliasDns] = useState(record?.alias_target?.dns_name ?? "");
  const [evalHealth, setEvalHealth] = useState(record?.alias_target?.evaluate_target_health ?? false);
  const [routing, setRouting] = useState<RoutingPolicy>(record?.routing_policy ?? "Simple");
  const [weight, setWeight] = useState(String(record?.weight ?? 100));
  const [setId, setSetId] = useState(record?.set_identifier ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rtype = type.value as RecordType;
  const protectedRec = !!record?.protected;
  const info = TYPE_INFO.find((t) => t.value === rtype)!;
  const aliasAllowed = ["A", "AAAA", "CNAME"].includes(rtype) && !protectedRec;

  async function submit() {
    setBusy(true); setError("");
    const payload = {
      name: name.trim() ? `${name.trim()}.${zone.name}` : zone.name,
      type: rtype,
      ttl: alias && aliasAllowed ? null : Number(ttl),
      values: alias && aliasAllowed ? [] : values.split("\n").map((v) => v.trim()).filter(Boolean),
      alias_target: alias && aliasAllowed ? { dns_name: aliasDns.trim(), evaluate_target_health: evalHealth } : null,
      routing_policy: routing, set_identifier: routing === "Weighted" ? setId.trim() : "",
      weight: routing === "Weighted" ? Number(weight) : null,
    };
    try {
      if (record) await api.updateRecord(zone.id, record.id, payload); else await api.createRecord(zone.id, payload);
      notify("success", editing ? `Record ${payload.name} was updated.` : `Successfully created record ${payload.name}.`);
      router.push(`/hosted-zones/${zone.id}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Form variant="full-page" errorText={error || undefined}
        header={<Header variant="h1" info={<Link variant="info">Info</Link>}
          description={editing ? undefined : "Create a record to route traffic for a domain or subdomain."}>{editing ? "Edit record" : "Quick create record"}</Header>}
        actions={<SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => router.push(`/hosted-zones/${zone.id}`)}>Cancel</Button>
          <Button variant="primary" formAction="submit" loading={busy}>{editing ? "Save" : "Create records"}</Button>
        </SpaceBetween>}>
        <Container header={<Header variant="h2" description={`Hosted zone: ${zone.name}`}>{editing ? record!.name : "Record 1"}</Header>}>
          <SpaceBetween size="l">
            <FormField label="Record name" info={<Link variant="info">Info</Link>} constraintText="Keep blank to create a record for the root domain.">
              <div className="record-name-row">
                <Input value={name} onChange={(e) => setName(e.detail.value)} disabled={protectedRec} placeholder="www" />
                <span className="record-name-suffix">.{zone.name}</span>
              </div>
            </FormField>
            <FormField label="Record type" info={<Link variant="info">Info</Link>}>
              <Select selectedOption={type} options={TYPE_OPTIONS} disabled={protectedRec}
                onChange={(e) => { setType(e.detail.selectedOption as typeof type); if (!["A", "AAAA", "CNAME"].includes(e.detail.selectedOption.value!)) setAlias(false); }} />
            </FormField>
            {aliasAllowed && <Toggle checked={alias} onChange={(e) => setAlias(e.detail.checked)}>Alias</Toggle>}
            {alias && aliasAllowed ? (
              <>
                <FormField label="Route traffic to" description="Enter the DNS name of the AWS resource, e.g. a CloudFront distribution or load balancer.">
                  <Input value={aliasDns} onChange={(e) => setAliasDns(e.detail.value)} placeholder="d111111abcdef8.cloudfront.net" />
                </FormField>
                <Toggle checked={evalHealth} onChange={(e) => setEvalHealth(e.detail.checked)}>Evaluate target health</Toggle>
              </>
            ) : (
              <>
                <FormField label="Value" info={<Link variant="info">Info</Link>} description="Enter multiple values on separate lines.">
                  <Textarea value={values} onChange={(e) => setValues(e.detail.value)} rows={4} placeholder={info.placeholder} />
                </FormField>
                <FormField label="TTL (seconds)" info={<Link variant="info">Info</Link>} constraintText="Recommended values: 60 to 172800 (two days)">
                  <Input type="number" inputMode="numeric" value={ttl} onChange={(e) => setTtl(e.detail.value)} />
                </FormField>
              </>
            )}
            <FormField label="Routing policy" info={<Link variant="info">Info</Link>} description="Route 53 responds to queries based only on the values in this record.">
              <Select selectedOption={ROUTING_OPTIONS.find((o) => o.value === routing)!} options={ROUTING_OPTIONS} disabled={protectedRec}
                onChange={(e) => setRouting(e.detail.selectedOption.value as RoutingPolicy)} />
            </FormField>
            {routing === "Weighted" && (
              <SpaceBetween size="l">
                <FormField label="Weight" constraintText="Enter a value between 0 and 255.">
                  <Input type="number" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.detail.value)} />
                </FormField>
                <FormField label="Record ID" constraintText="Identifies this record among those with the same name and type.">
                  <Input value={setId} onChange={(e) => setSetId(e.detail.value)} placeholder="Enter a unique ID" />
                </FormField>
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Container>
        <Box padding={{ bottom: "l" }} />
      </Form>
    </form>
  );
}

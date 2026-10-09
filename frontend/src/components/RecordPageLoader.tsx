"use client";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import { RecordForm } from "./RecordForm";
import { api } from "@/lib/api";
import { useBreadcrumbs } from "@/lib/breadcrumbs";
import type { DnsRecord, HostedZone } from "@/lib/types";

/** Loads the zone (and optionally a record) then renders the shared record form. */
export function RecordPageLoader({ zoneId, recordId }: { zoneId: string; recordId?: number }) {
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [record, setRecord] = useState<DnsRecord | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getZone(zoneId), recordId !== undefined ? api.getRecord(zoneId, recordId) : Promise.resolve(undefined)])
      .then(([z, r]) => { setZone(z); setRecord(r); })
      .catch((e) => setError((e as Error).message));
  }, [zoneId, recordId]);

  useBreadcrumbs([
    { text: "Route 53", href: "/dashboard" }, { text: "Hosted zones", href: "/hosted-zones" },
    { text: zone?.name ?? zoneId, href: `/hosted-zones/${zoneId}` },
    { text: recordId !== undefined ? "Edit record" : "Create record", href: "#" },
  ]);

  if (error) return <Alert type="error" header="Unable to load">{error}</Alert>;
  if (!zone) return <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>;
  return <RecordForm zone={zone} record={record} />;
}

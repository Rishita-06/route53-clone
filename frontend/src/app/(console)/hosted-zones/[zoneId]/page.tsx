"use client";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Spinner from "@cloudscape-design/components/spinner";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tabs from "@cloudscape-design/components/tabs";
import Alert from "@cloudscape-design/components/alert";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RecordsTable } from "@/components/RecordsTable";
import { TagRow, TagsEditor, tagsToObject } from "@/components/TagsEditor";
import { DeleteZoneModal, EditZoneModal } from "@/components/ZoneModals";
import { api, ApiError } from "@/lib/api";
import { useBreadcrumbs } from "@/lib/breadcrumbs";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";
import { formatDate } from "@/lib/ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Box variant="awsui-key-label">{label}</Box><div>{children}</div></div>;
}

export default function HostedZoneDetail() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("records");
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [tagRows, setTagRows] = useState<TagRow[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  const load = useCallback(() => {
    api.getZone(zoneId).then((z) => { setZone(z); setTagRows(Object.entries(z.tags).map(([key, value]) => ({ key, value }))); })
      .catch((e) => setError((e as ApiError).message));
  }, [zoneId]);
  useEffect(load, [load]);

  useBreadcrumbs([
    { text: "Route 53", href: "/dashboard" }, { text: "Hosted zones", href: "/hosted-zones" },
    { text: zone?.name ?? zoneId, href: `/hosted-zones/${zoneId}` },
  ]);

  if (error) return <Alert type="error" header="Unable to load hosted zone">{error}</Alert>;
  if (!zone) return <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>;

  async function saveTags() {
    setSavingTags(true);
    try { await api.updateZone(zoneId, { tags: tagsToObject(tagRows) }); notify("success", "Tags were updated."); load(); }
    catch (e) { notify("error", (e as Error).message); }
    finally { setSavingTags(false); }
  }

  return (
    <SpaceBetween size="l">
      <Header variant="h1" info={<Link variant="info">Info</Link>}
        actions={<SpaceBetween direction="horizontal" size="xs">
          <Button onClick={() => setShowDelete(true)}>Delete zone</Button>
          <Button disabled>Test record</Button>
          <Button disabled>Configure query logging</Button>
        </SpaceBetween>}>
        {zone.name}
      </Header>

      <Container header={<Header variant="h2" actions={<Button onClick={() => setShowEdit(true)}>Edit hosted zone</Button>}>Hosted zone details</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <Field label="Hosted zone name">{zone.name}</Field>
          <Field label="Hosted zone ID"><span className="mono">{zone.id}</span></Field>
          <Field label="Description">{zone.comment || "-"}</Field>
          <Field label="Type">{zone.is_private ? "Private hosted zone" : "Public hosted zone"}</Field>
          <Field label="Record count">{zone.record_count}</Field>
          <Field label="Created by">{zone.created_by}</Field>
          <Field label="Created">{formatDate(zone.created_at)}</Field>
          {zone.is_private && <Field label="Associated VPC">{zone.vpc_id} ({zone.vpc_region})</Field>}
        </ColumnLayout>
      </Container>

      <Tabs activeTabId={tab} onChange={(e) => setTab(e.detail.activeTabId)} tabs={[
        { id: "records", label: `Records (${zone.record_count})`, content: <RecordsTable zone={zone} onChanged={load} /> },
        { id: "dnssec", label: "DNSSEC signing", content: <Container header={<Header variant="h2">DNSSEC signing</Header>}><Box color="text-body-secondary">DNSSEC signing is not available in this clone. <b>Coming soon.</b></Box></Container> },
        { id: "logging", label: "Query logging", content: <Container header={<Header variant="h2">Query logging</Header>}><Box color="text-body-secondary">Query logging is not available in this clone. <b>Coming soon.</b></Box></Container> },
        { id: "tags", label: `Hosted zone tags (${Object.keys(zone.tags).length})`, content: (
          <Container header={<Header variant="h2" actions={<Button variant="primary" onClick={saveTags} loading={savingTags}>Save changes</Button>}>Hosted zone tags</Header>}>
            <TagsEditor rows={tagRows} onChange={setTagRows} />
          </Container>) },
      ]} />

      <DeleteZoneModal zone={showDelete ? zone : null} onDismiss={() => setShowDelete(false)} onDeleted={() => router.push("/hosted-zones")} />
      <EditZoneModal zone={showEdit ? zone : null} onDismiss={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />
    </SpaceBetween>
  );
}

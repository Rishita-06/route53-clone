"use client";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImportZoneModal } from "./ImportZoneModal";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { DnsRecord, HostedZone, Page } from "@/lib/types";
import { useDebounced } from "@/lib/ui";

const ALL = { label: "Any", value: "" };
const TYPES = [ALL, ...["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SOA", "SRV", "TXT"].map((t) => ({ label: t, value: t }))];
const ROUTING = [ALL, { label: "Simple", value: "Simple" }, { label: "Weighted", value: "Weighted" }];

export function RecordsTable({ zone, onChanged }: { zone: HostedZone; onChanged: () => void }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [type, setType] = useState(TYPES[0]);
  const [routing, setRouting] = useState(ROUTING[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [wrapLines, setWrapLines] = useState(false);
  const [sort, setSort] = useState({ field: "name", desc: false });
  const [data, setData] = useState<Page<DnsRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DnsRecord[]>([]);
  const [reload, setReload] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listRecords(zone.id, { search: debounced, type: type.value, routing_policy: routing.value, page, page_size: pageSize, sort: sort.field, order: sort.desc ? "desc" : "asc" })
      .then((d) => { if (!cancelled) { setData(d); setSelected([]); } })
      .catch((e) => notify("error", (e as Error).message, "Failed to load records"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.id, debounced, type, routing, page, pageSize, sort, reload]);

  const refresh = () => { setReload((n) => n + 1); onChanged(); };
  const hasProtected = selected.some((r) => r.protected);

  async function doDelete() {
    setDeleting(true); setDeleteError("");
    try {
      const { deleted } = await api.deleteRecords(zone.id, selected.map((r) => r.id));
      notify("success", `Successfully deleted ${deleted} record${deleted === 1 ? "" : "s"}.`);
      setConfirmDelete(false); refresh();
    } catch (e) { setDeleteError((e as Error).message); }
    finally { setDeleting(false); }
  }

  const renderValue = (r: DnsRecord) =>
    r.alias_target ? r.alias_target.dns_name : <span className="value-cell">{r.values.join("\n")}</span>;

  const col = (id: string, header: string, cell: (r: DnsRecord) => React.ReactNode, sortable = false, width?: number) =>
    ({ id, header, cell, sortingField: sortable ? id : undefined, width, minWidth: 80 });

  return (
    <>
      <Table<DnsRecord>
        variant="embedded" resizableColumns wrapLines={wrapLines} loading={loading} loadingText="Loading records"
        items={data?.items ?? []} trackBy="id" selectionType="multi" selectedItems={selected}
        onSelectionChange={(e) => setSelected(e.detail.selectedItems)}
        ariaLabels={{ selectionGroupLabel: "Record selection", itemSelectionLabel: (_, i) => `${i.name} ${i.type}`, allItemsSelectionLabel: () => "select all" }}
        sortingColumn={{ sortingField: sort.field }} sortingDescending={sort.desc}
        onSortingChange={(e) => { setSort({ field: e.detail.sortingColumn.sortingField ?? "name", desc: !!e.detail.isDescending }); setPage(1); }}
        columnDefinitions={[
          col("name", "Record name", (r) => <Link onFollow={(e) => { e.preventDefault(); router.push(`/hosted-zones/${zone.id}/records/${r.id}/edit`); }} href={`/hosted-zones/${zone.id}/records/${r.id}/edit`}>{r.name}</Link>, true, 240),
          col("type", "Type", (r) => r.type, true, 90),
          col("routing_policy", "Routing policy", (r) => r.routing_policy, true, 130),
          col("differentiator", "Differentiator", (r) => r.set_identifier ? `Weight: ${r.weight} (${r.set_identifier})` : "-", false, 170),
          col("alias", "Alias", (r) => (r.alias_target ? "Yes" : "No"), false, 80),
          col("value", "Value/Route traffic to", renderValue, false, 300),
          col("ttl", "TTL (seconds)", (r) => r.ttl ?? "-", true, 120),
          col("eval", "Evaluate target health", (r) => (r.alias_target ? (r.alias_target.evaluate_target_health ? "Yes" : "No") : "-"), false, 170),
        ]}
        header={
          <Header
            variant="h2" counter={data ? `(${data.total})` : undefined} info={<Link variant="info">Info</Link>}
            description="Automatic mode is the current search behavior optimized for best filter results. To change modes go to settings."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled={selected.length === 0 || hasProtected} onClick={() => { setDeleteError(""); setConfirmDelete(true); }}>Delete record</Button>
                <Button onClick={() => setShowImport(true)}>Import zone file</Button>
                <ButtonDropdown
                  items={[{ id: "json", text: "Export as JSON" }, { id: "bind", text: "Export as BIND zone file" }]}
                  onItemClick={({ detail }) => api.exportZone(zone.id, detail.id as "json" | "bind", zone.name).catch((e) => notify("error", (e as Error).message))}
                >Export</ButtonDropdown>
                <Button disabled={selected.length !== 1} onClick={() => router.push(`/hosted-zones/${zone.id}/records/${selected[0].id}/edit`)}>Edit record</Button>
                <Button variant="primary" onClick={() => router.push(`/hosted-zones/${zone.id}/records/create`)}>Create record</Button>
              </SpaceBetween>
            }
          >Records</Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <div style={{ minWidth: 340 }}>
              <TextFilter filteringText={search} filteringPlaceholder="Filter records by property or value" filteringAriaLabel="Filter records"
                countText={data ? `${data.total} ${data.total === 1 ? "match" : "matches"}` : undefined}
                onChange={(e) => { setSearch(e.detail.filteringText); setPage(1); }} />
            </div>
            <Select selectedOption={type} options={TYPES} onChange={(e) => { setType(e.detail.selectedOption as typeof type); setPage(1); }} ariaLabel="Type" />
            <Select selectedOption={routing} options={ROUTING} onChange={(e) => { setRouting(e.detail.selectedOption as typeof routing); setPage(1); }} ariaLabel="Routing policy" />
          </SpaceBetween>
        }
        pagination={<Pagination currentPageIndex={page} pagesCount={data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1} onChange={(e) => setPage(e.detail.currentPageIndex)} />}
        preferences={
          <CollectionPreferences title="Preferences" confirmLabel="Confirm" cancelLabel="Cancel" preferences={{ pageSize, wrapLines }}
            onConfirm={({ detail }) => { setPageSize(detail.pageSize ?? 10); setWrapLines(!!detail.wrapLines); setPage(1); }}
            pageSizePreference={{ title: "Page size", options: [10, 20, 50, 100].map((v) => ({ value: v, label: `${v} records` })) }}
            wrapLinesPreference={{ label: "Wrap lines", description: "Select to see all the text and wrap the lines" }} />
        }
        empty={
          <Box textAlign="center" padding={{ vertical: "l" }}>
            <Box variant="strong">{debounced || type.value || routing.value ? "No matches" : "No records"}</Box>
            <Box variant="p" padding={{ bottom: "s" }}>{debounced || type.value || routing.value ? "We can't find a match." : "This hosted zone has no records."}</Box>
          </Box>
        }
      />

      <Modal visible={confirmDelete} onDismiss={() => setConfirmDelete(false)} header={`Delete record${selected.length === 1 ? "" : "s"}`}
        footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="primary" onClick={doDelete} loading={deleting}>Delete</Button>
        </SpaceBetween></Box>}>
        <SpaceBetween size="m">
          {deleteError && <Alert type="error">{deleteError}</Alert>}
          <Box>Are you sure you want to delete the following {selected.length === 1 ? "record" : `${selected.length} records`}?</Box>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {selected.map((r) => <li key={r.id}><b>{r.name}</b> <span style={{ opacity: 0.7 }}>({r.type})</span></li>)}
          </ul>
        </SpaceBetween>
      </Modal>
      <ImportZoneModal zoneId={zone.id} visible={showImport} onDismiss={() => setShowImport(false)} onImported={refresh} />
    </>
  );
}

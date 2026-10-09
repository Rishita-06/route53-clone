"use client";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DeleteZoneModal, EditZoneModal } from "@/components/ZoneModals";
import { api } from "@/lib/api";
import { useBreadcrumbs } from "@/lib/breadcrumbs";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone, Page } from "@/lib/types";
import { useDebounced, useFollow } from "@/lib/ui";

const TYPE_OPTIONS = [
  { label: "Any type", value: "" },
  { label: "Public hosted zones", value: "public" },
  { label: "Private hosted zones", value: "private" },
];

export default function HostedZonesPage() {
  useBreadcrumbs([{ text: "Route 53", href: "/dashboard" }, { text: "Hosted zones", href: "/hosted-zones" }]);
  const router = useRouter();
  const follow = useFollow();
  const { notify } = useNotifications();

  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [type, setType] = useState(TYPE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [wrapLines, setWrapLines] = useState(false);
  const [sort, setSort] = useState<{ field: string; desc: boolean }>({ field: "name", desc: false });
  const [data, setData] = useState<Page<HostedZone> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [reload, setReload] = useState(0);
  const [toDelete, setToDelete] = useState<HostedZone | null>(null);
  const [toEdit, setToEdit] = useState<HostedZone | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listZones({ search: debounced, type: type.value, page, page_size: pageSize, sort: sort.field, order: sort.desc ? "desc" : "asc" })
      .then((d) => { if (!cancelled) { setData(d); setSelected([]); } })
      .catch((e) => notify("error", (e as Error).message, "Failed to load hosted zones"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, type, page, pageSize, sort, reload]);

  const sel = selected[0];
  const pagesCount = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  const col = (id: string, header: string, cell: (z: HostedZone) => React.ReactNode, sortable = true, width?: number) =>
    ({ id, header, cell, sortingField: sortable ? id : undefined, width, minWidth: 100 });

  return (
    <>
      <Table<HostedZone>
        variant="full-page" stickyHeader resizableColumns wrapLines={wrapLines}
        loading={loading} loadingText="Loading hosted zones"
        items={data?.items ?? []} trackBy="id"
        selectionType="single" selectedItems={selected} onSelectionChange={(e) => setSelected(e.detail.selectedItems)}
        ariaLabels={{ selectionGroupLabel: "Hosted zone selection", itemSelectionLabel: (_, i) => i.name, allItemsSelectionLabel: () => "select all" }}
        sortingColumn={{ sortingField: sort.field }} sortingDescending={sort.desc}
        onSortingChange={(e) => { setSort({ field: e.detail.sortingColumn.sortingField ?? "name", desc: !!e.detail.isDescending }); setPage(1); }}
        columnDefinitions={[
          col("name", "Hosted zone name", (z) => <Link href={`/hosted-zones/${z.id}`} onFollow={follow}>{z.name}</Link>, true, 240),
          col("type", "Type", (z) => (z.is_private ? "Private" : "Public"), true, 100),
          col("created_by", "Created by", (z) => z.created_by, false, 130),
          col("record_count", "Record count", (z) => z.record_count, true, 130),
          col("comment", "Description", (z) => z.comment || "-", true, 220),
          col("id", "Hosted zone ID", (z) => <span className="mono">{z.id}</span>, true, 230),
        ]}
        header={
          <Header
            variant="awsui-h1-sticky" counter={data ? `(${data.total})` : undefined}
            info={<Link variant="info">Info</Link>}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled={!sel} onClick={() => sel && router.push(`/hosted-zones/${sel.id}`)}>View details</Button>
                <Button disabled={!sel} onClick={() => setToEdit(sel)}>Edit</Button>
                <Button disabled={!sel} onClick={() => setToDelete(sel)}>Delete</Button>
                <Button variant="primary" onClick={() => router.push("/hosted-zones/create")}>Create hosted zone</Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <div style={{ minWidth: 380 }}>
              <TextFilter
                filteringText={search} filteringPlaceholder="Filter hosted zones by property or value"
                filteringAriaLabel="Filter hosted zones" countText={data ? `${data.total} ${data.total === 1 ? "match" : "matches"}` : undefined}
                onChange={(e) => { setSearch(e.detail.filteringText); setPage(1); }}
              />
            </div>
            <Select selectedOption={type} options={TYPE_OPTIONS} onChange={(e) => { setType(e.detail.selectedOption as typeof type); setPage(1); }} ariaLabel="Hosted zone type" />
          </SpaceBetween>
        }
        pagination={<Pagination currentPageIndex={page} pagesCount={pagesCount} onChange={(e) => setPage(e.detail.currentPageIndex)} />}
        preferences={
          <CollectionPreferences
            title="Preferences" confirmLabel="Confirm" cancelLabel="Cancel"
            preferences={{ pageSize, wrapLines }}
            onConfirm={({ detail }) => { setPageSize(detail.pageSize ?? 10); setWrapLines(!!detail.wrapLines); setPage(1); }}
            pageSizePreference={{ title: "Page size", options: [10, 20, 50, 100].map((v) => ({ value: v, label: `${v} hosted zones` })) }}
            wrapLinesPreference={{ label: "Wrap lines", description: "Select to see all the text and wrap the lines" }}
          />
        }
        empty={
          <Box textAlign="center" color="inherit" padding={{ vertical: "l" }}>
            <Box variant="strong" textAlign="center" color="inherit">{debounced || type.value ? "No matches" : "No hosted zones"}</Box>
            <Box variant="p" padding={{ bottom: "s" }} color="inherit">
              {debounced || type.value ? "We can't find a match." : "You don't have any hosted zones."}
            </Box>
            {!debounced && !type.value && <Button onClick={() => router.push("/hosted-zones/create")}>Create hosted zone</Button>}
          </Box>
        }
      />
      <DeleteZoneModal zone={toDelete} onDismiss={() => setToDelete(null)} onDeleted={() => { setToDelete(null); setReload((n) => n + 1); }} />
      <EditZoneModal zone={toEdit} onDismiss={() => setToEdit(null)} onSaved={() => { setToEdit(null); setReload((n) => n + 1); }} />
    </>
  );
}

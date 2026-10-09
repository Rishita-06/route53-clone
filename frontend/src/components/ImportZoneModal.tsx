"use client";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import FormField from "@cloudscape-design/components/form-field";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useState } from "react";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { ImportResult } from "@/lib/types";

export function ImportZoneModal({ zoneId, visible, onDismiss, onImported }: { zoneId: string; visible: boolean; onDismiss: () => void; onImported: () => void }) {
  const { notify } = useNotifications();
  const [content, setContent] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const close = () => { setContent(""); setResult(null); setError(""); onDismiss(); };

  async function run() {
    setBusy(true); setError("");
    try {
      const r = await api.importZone(zoneId, content, overwrite);
      setResult(r);
      if (r.created + r.updated > 0) {
        notify("success", `Imported ${r.created} record(s), updated ${r.updated}, skipped ${r.skipped}.`);
        onImported();
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} onDismiss={close} size="large" header="Import zone file"
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs">
        <Button variant="link" onClick={close}>{result ? "Close" : "Cancel"}</Button>
        <Button variant="primary" onClick={run} loading={busy} disabled={!content.trim()}>Import</Button>
      </SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {error && <Alert type="error">{error}</Alert>}
        {result && (
          <Alert type={result.errors.length ? "warning" : "success"} header="Import finished">
            Created {result.created}, updated {result.updated}, skipped {result.skipped}.
            {result.errors.map((e, i) => <div key={i}>{e}</div>)}
          </Alert>
        )}
        <FormField label="Zone file" description="Paste the contents of a BIND-format zone file, or upload one. SOA and apex NS records are skipped.">
          <Textarea value={content} onChange={(e) => setContent(e.detail.value)} rows={12} placeholder={"$TTL 300\nwww IN A 192.0.2.10\n@ IN MX 10 mail.example.com."} />
        </FormField>
        <input type="file" accept=".zone,.txt,.db,text/plain" aria-label="Upload zone file"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) setContent(await f.text()); }} />
        <Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.detail.checked)}>Overwrite existing records with the same name and type</Checkbox>
      </SpaceBetween>
    </Modal>
  );
}

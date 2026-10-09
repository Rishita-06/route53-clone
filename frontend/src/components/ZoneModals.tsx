"use client";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";

export function DeleteZoneModal({ zone, onDismiss, onDeleted }: { zone: HostedZone | null; onDismiss: () => void; onDeleted: () => void }) {
  const { notify } = useNotifications();
  const [text, setText] = useState("");
  const [force, setForce] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(""); setForce(false); setError(""); }, [zone?.id]);

  async function confirm() {
    if (!zone) return;
    setBusy(true); setError("");
    try {
      await api.deleteZone(zone.id, force);
      notify("success", `Successfully deleted hosted zone ${zone.name}.`);
      onDeleted();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      visible={!!zone} onDismiss={onDismiss} header="Delete hosted zone" size="medium"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>Cancel</Button>
            <Button variant="primary" onClick={confirm} loading={busy} disabled={text !== "delete"}>Delete</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {error && <Alert type="error" header="Unable to delete hosted zone">{error}</Alert>}
        <Box>Are you sure you want to permanently delete the hosted zone <b>{zone?.name}</b>? This can&apos;t be undone.</Box>
        {error && <Checkbox checked={force} onChange={(e) => setForce(e.detail.checked)}>Also delete all records in this hosted zone</Checkbox>}
        <FormField label={<>To confirm deletion, type <i>delete</i> in the field.</>}>
          <Input value={text} onChange={(e) => setText(e.detail.value)} placeholder="delete" />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

export function EditZoneModal({ zone, onDismiss, onSaved }: { zone: HostedZone | null; onDismiss: () => void; onSaved: (z: HostedZone) => void }) {
  const { notify } = useNotifications();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setComment(zone?.comment ?? ""); setError(""); }, [zone]);

  async function save() {
    if (!zone) return;
    setBusy(true); setError("");
    try {
      const z = await api.updateZone(zone.id, { comment });
      notify("success", `Hosted zone ${zone.name} was updated.`);
      onSaved(z);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      visible={!!zone} onDismiss={onDismiss} header="Edit hosted zone"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy}>Save changes</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {error && <Alert type="error">{error}</Alert>}
        <FormField label="Description" description="The comment that you want to associate with the hosted zone." constraintText="Up to 256 characters.">
          <Textarea value={comment} onChange={(e) => setComment(e.detail.value)} rows={3} />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

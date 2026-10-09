"use client";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Grid from "@cloudscape-design/components/grid";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";

export interface TagRow { key: string; value: string }
export const tagsToObject = (rows: TagRow[]) => Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));

export function TagsEditor({ rows, onChange }: { rows: TagRow[]; onChange: (r: TagRow[]) => void }) {
  const set = (i: number, patch: Partial<TagRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <SpaceBetween size="s">
      {rows.length === 0 && <Box color="text-body-secondary">No tags associated with the resource.</Box>}
      {rows.map((r, i) => (
        <Grid key={i} gridDefinition={[{ colspan: 5 }, { colspan: 5 }, { colspan: 2 }]}>
          <Input value={r.key} placeholder="Enter key" onChange={(e) => set(i, { key: e.detail.value })} />
          <Input value={r.value} placeholder="Enter value" onChange={(e) => set(i, { value: e.detail.value })} />
          <Button onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</Button>
        </Grid>
      ))}
      <Button onClick={() => onChange([...rows, { key: "", value: "" }])} disabled={rows.length >= 50}>Add new tag</Button>
      <Box variant="small" color="text-body-secondary">You can add up to {50 - rows.length} more tags.</Box>
    </SpaceBetween>
  );
}

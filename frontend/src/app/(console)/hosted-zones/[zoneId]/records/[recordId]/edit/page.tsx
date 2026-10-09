"use client";
import { useParams } from "next/navigation";
import { RecordPageLoader } from "@/components/RecordPageLoader";

export default function EditRecordPage() {
  const { zoneId, recordId } = useParams<{ zoneId: string; recordId: string }>();
  return <RecordPageLoader zoneId={zoneId} recordId={Number(recordId)} />;
}

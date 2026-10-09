"use client";
import { useParams } from "next/navigation";
import { RecordPageLoader } from "@/components/RecordPageLoader";

export default function CreateRecordPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  return <RecordPageLoader zoneId={zoneId} />;
}

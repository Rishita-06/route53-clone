"use client";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import RadioGroup from "@cloudscape-design/components/radio-group";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagRow, TagsEditor, tagsToObject } from "@/components/TagsEditor";
import { api, ApiError } from "@/lib/api";
import { useBreadcrumbs } from "@/lib/breadcrumbs";
import { useNotifications } from "@/lib/notifications";

const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1", "ap-southeast-1"]
  .map((r) => ({ label: r, value: r }));
const DOMAIN_RE = /^(?=.{1,253}\.?$)([A-Za-z0-9_*]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?\.)*[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?\.?$/;

export default function CreateHostedZonePage() {
  useBreadcrumbs([
    { text: "Route 53", href: "/dashboard" }, { text: "Hosted zones", href: "/hosted-zones" },
    { text: "Create hosted zone", href: "/hosted-zones/create" },
  ]);
  const router = useRouter();
  const { notify } = useNotifications();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [region, setRegion] = useState(REGIONS[0]);
  const [vpc, setVpc] = useState("");
  const [tags, setTags] = useState<TagRow[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  const nameError = !name.trim() ? "Domain name is required." : !DOMAIN_RE.test(name.trim()) ? "Invalid domain name." : "";
  const vpcError = type === "private" && !vpc.trim() ? "VPC ID is required for private hosted zones." : "";

  async function submit() {
    setTouched(true); setServerError("");
    if (nameError || vpcError) return;
    setBusy(true);
    try {
      const z = await api.createZone({
        name: name.trim(), comment: comment.trim(), is_private: type === "private",
        vpc_id: type === "private" ? vpc.trim() : undefined, vpc_region: type === "private" ? region.value : undefined,
        tags: tagsToObject(tags),
      });
      notify("success", `Successfully created hosted zone ${z.name}`);
      router.push(`/hosted-zones/${z.id}`);
    } catch (e) { setServerError((e as ApiError).message); setBusy(false); }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Form
        variant="full-page" errorText={serverError || undefined}
        header={<Header variant="h1" info={<Link variant="info">Info</Link>} description="A hosted zone is a container for records, and records contain information about how you want to route traffic for a specific domain, such as example.com, and its subdomains.">Create hosted zone</Header>}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => router.push("/hosted-zones")}>Cancel</Button>
            <Button variant="primary" formAction="submit" loading={busy}>Create hosted zone</Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Container header={<Header variant="h2" info={<Link variant="info">Info</Link>} description="The name of the domain that you want to route traffic for.">Hosted zone configuration</Header>}>
            <SpaceBetween size="l">
              <FormField label="Domain name" info={<Link variant="info">Info</Link>} description="This is the name of the domain that you want to route traffic for."
                constraintText={'Valid characters: a-z, 0-9, ! " # $ % & \' ( ) * + , - / : ; < = > ? @ [ \\ ] ^ _ ` { | } . ~'}
                errorText={touched ? nameError : ""}>
                <Input value={name} onChange={(e) => setName(e.detail.value)} placeholder="example.com" />
              </FormField>
              <FormField label={<>Description <i>- optional</i></>} description="This value lets you distinguish hosted zones that have the same name." constraintText="The description can have up to 256 characters. 256 remaining">
                <Textarea value={comment} onChange={(e) => setComment(e.detail.value.slice(0, 256))} rows={3} placeholder="The hosted zone is used for…" />
              </FormField>
              <FormField label="Type" info={<Link variant="info">Info</Link>} description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC.">
                <RadioGroup value={type} onChange={(e) => setType(e.detail.value as "public" | "private")} items={[
                  { value: "public", label: "Public hosted zone", description: "A public hosted zone determines how traffic is routed on the internet." },
                  { value: "private", label: "Private hosted zone", description: "A private hosted zone determines how traffic is routed within an Amazon VPC." },
                ]} />
              </FormField>
              {type === "private" && (
                <SpaceBetween size="l">
                  <FormField label="Region" description="Select the Region of the VPC to associate with this hosted zone.">
                    <Select selectedOption={region} options={REGIONS} onChange={(e) => setRegion(e.detail.selectedOption as typeof region)} />
                  </FormField>
                  <FormField label="VPC ID" errorText={touched ? vpcError : ""}>
                    <Input value={vpc} onChange={(e) => setVpc(e.detail.value)} placeholder="vpc-0123456789abcdef0" />
                  </FormField>
                </SpaceBetween>
              )}
            </SpaceBetween>
          </Container>
          <Container header={<Header variant="h2" info={<Link variant="info">Info</Link>} description="Apply tags to hosted zones to help organize and identify them.">Tags</Header>}>
            <TagsEditor rows={tags} onChange={setTags} />
          </Container>
          <Box />
        </SpaceBetween>
      </Form>
    </form>
  );
}

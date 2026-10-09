"use client";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import { notFound, useParams } from "next/navigation";
import { useBreadcrumbs } from "@/lib/breadcrumbs";
import { MOCK_PAGES } from "@/lib/navigation";

export default function ComingSoon() {
  const { section } = useParams<{ section: string }>();
  const title = MOCK_PAGES[section];
  useBreadcrumbs([{ text: "Route 53", href: "/dashboard" }, { text: title ?? "", href: `/${section}` }]);
  if (!title) notFound();

  return (
    <ContentLayout header={<Header variant="h1">{title}</Header>}>
      <Container>
        <Box textAlign="center" padding={{ vertical: "xxl" }}>
          <Box variant="h2" padding={{ bottom: "xs" }}>Coming soon</Box>
          <Box color="text-body-secondary">The {title} section is not part of this clone yet.</Box>
        </Box>
      </Container>
    </ContentLayout>
  );
}

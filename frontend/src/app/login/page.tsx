"use client";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AWS_LOGO_DARK } from "@/lib/logo";

export default function LoginPage() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [accountId, setAccountId] = useState("123456789012");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (status === "authenticated") router.replace("/hosted-zones"); }, [status, router]);

  async function submit() {
    setBusy(true); setError("");
    try { await signIn(accountId.trim(), username.trim(), password); router.replace("/hosted-zones"); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="login-logo" src={AWS_LOGO_DARK} alt="AWS" />
      <div className="login-card">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <SpaceBetween size="l">
            <Header variant="h1">Sign in as IAM user</Header>
            {error && <Alert type="error" header="Authentication failed">{error}</Alert>}
            <FormField label="Account ID (12 digits) or account alias">
              <Input value={accountId} onChange={(e) => setAccountId(e.detail.value)} />
            </FormField>
            <FormField label="IAM user name">
              <Input value={username} onChange={(e) => setUsername(e.detail.value)} />
            </FormField>
            <FormField label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.detail.value)} autoFocus />
            </FormField>
            <Button variant="primary" formAction="submit" loading={busy} fullWidth disabled={!password}>Sign in</Button>
            <Box variant="small" color="text-body-secondary">
              Demo credentials — account <b>123456789012</b>, user <b>admin</b>, password <b>admin123</b>.
              Authentication is mocked.
            </Box>
          </SpaceBetween>
        </form>
      </div>
    </div>
  );
}

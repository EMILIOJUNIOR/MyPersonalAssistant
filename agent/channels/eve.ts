import { eveChannel } from "eve/channels/eve";
import type { EveAuthFn } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";

const authenticateLocalDev = localDev();

/**
 * Lets `eve eval` create sessions with tool stubs. The grant only applies to callers the
 * local dev authenticator accepts, so it never exists in a deployed environment.
 */
const localDevWithStubs: EveAuthFn = async (request) => {
  const caller = await authenticateLocalDev(request);
  return caller ? { ...caller, allowToolStubs: true } : null;
};

export default eveChannel({
  auth: [
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL, plus tool stubs for evals.
    localDevWithStubs,
    // This placeholder will not allow browser requests in production.
    // Replace it with your app's auth provider, like Auth.js or Clerk,
    // or use none() for a public demo.
    placeholderAuth(),
  ],
});

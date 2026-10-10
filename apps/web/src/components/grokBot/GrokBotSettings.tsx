import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { RefreshCwIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { RefreshIcon } from "~/components/ui/refresh-icon";
import { Spinner } from "~/components/ui/spinner";
import {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "~/components/settings/settingsLayout";
import { searchableSetting } from "~/components/settings/settingsSearch";
import { useSettingsScope } from "~/components/settings/SettingsScopeContext";
import { useProjects } from "~/state/entities";
import { grokBotsListQuery, grokBotsSetup, grokBotsStatusQuery } from "~/state/grokBots";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

import { GrokBotLimitations } from "./GrokBotLimitations";
import { GrokBotProfileEditor } from "./GrokBotProfileEditor";
import {
  grokBotFailureMessage,
  grokBotSurfaceKey,
  resolveGrokBotSettingsEnvironment,
  sortGrokBotsForEditor,
} from "./grokBotPresentation";

export function GrokBotSettings({ botId }: { readonly botId?: string | undefined }) {
  const { scope, connectedEnvironments } = useSettingsScope();
  const resolved = resolveGrokBotSettingsEnvironment({
    scopeKind: scope.kind,
    scopeEnvironmentId: scope.kind === "environment" ? scope.environmentId : null,
    connectedEnvironmentIds: connectedEnvironments.map((environment) => environment.environmentId),
  });
  if (resolved.kind === "environment") {
    return <GrokBotSettingsBody environmentId={resolved.environmentId} selectedBotId={botId} />;
  }
  if (resolved.kind === "disconnected") {
    return (
      <SettingsPageContainer>
        <SettingsSection title="Grok Bots">
          <SettingsRow
            title="Reconnect this environment"
            description="Grok Bots stay with the selected environment. Reconnect it to continue."
          />
        </SettingsSection>
      </SettingsPageContainer>
    );
  }
  if (resolved.kind === "choose-environment") {
    return (
      <SettingsPageContainer>
        <SettingsSection title="Grok Bots">
          <SettingsRow
            title="Choose an environment"
            description="Grok Bots belong to one environment. Pick it in the scope selector."
          />
        </SettingsSection>
      </SettingsPageContainer>
    );
  }
  return (
    <SettingsPageContainer>
      <SettingsSection title="Grok Bots">
        <SettingsRow
          title="No environment connected"
          description="Connect an environment to set up Grok Bots."
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

function GrokBotSettingsBody({
  environmentId,
  selectedBotId,
}: {
  readonly environmentId: EnvironmentId;
  readonly selectedBotId?: string | undefined;
}) {
  const status = useEnvironmentQuery(grokBotsStatusQuery({ environmentId, input: {} }));
  const roster = useEnvironmentQuery(
    status.data?.installed === true && status.data.sessionPresent === true
      ? grokBotsListQuery({ environmentId, input: {} })
      : null,
  );
  const canSetup = useAtomValue(grokBotsSetup.permissionAtom(environmentId));
  const setup = useAtomCommand(grokBotsSetup, { reportFailure: false });
  const [setupPending, setSetupPending] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const bots = useMemo(() => sortGrokBotsForEditor(roster.data ?? []), [roster.data]);
  const selected = bots.find((bot) => bot.id === selectedBotId) ?? bots[0] ?? null;
  const projects = useProjects().filter((project) => project.environmentId === environmentId);

  const refreshAll = () => {
    status.refresh();
    roster.refresh();
  };

  const runSetup = async () => {
    setSetupPending(true);
    setSetupError(null);
    const result = await setup({ environmentId, input: {} });
    setSetupPending(false);
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return;
      setSetupError(grokBotFailureMessage(squashAtomCommandFailure(result)));
    }
  };

  return (
    <SettingsPageContainer>
      <SettingsSection
        {...searchableSetting("grok-bots-bridge")}
        headerAction={
          <Button size="xs" variant="ghost-muted" onClick={refreshAll}>
            <RefreshIcon refreshing={status.isPending || roster.isPending} />
            Refresh
          </Button>
        }
      >
        <SettingsRow
          title="Connection"
          description={connectionCopy(status.data, status.error, status.isPending)}
          control={
            status.data?.installed === true ? (
              <span className="text-xs text-muted-foreground">
                {status.data.managed ? "Installed for this environment" : "Installed"}
                {status.data.sessionPresent ? " · Signed in" : " · Sign in required"}
              </span>
            ) : (
              <Button
                size="sm"
                disabled={!canSetup || setupPending}
                onClick={() => void runSetup()}
              >
                {setupPending ? <Spinner size="xs" /> : null}
                Set up Grok Bot
              </Button>
            )
          }
        />
        {status.data?.installed === true && status.data.sessionPresent !== true ? (
          <SettingsRow
            title="Sign in"
            description="Open Grok Bot on this computer, sign in, then refresh. T3 Code keeps the signed-in session on the environment."
            control={
              <Button size="sm" variant="outline" onClick={refreshAll}>
                <RefreshCwIcon />
                Refresh connection
              </Button>
            }
          />
        ) : null}
        {setupError ? (
          <SettingsRow title="Setup could not finish" description={setupError} />
        ) : null}
        {status.error ? (
          <SettingsRow title="Could not read the connection" description={status.error} />
        ) : null}
      </SettingsSection>

      <SettingsSection {...searchableSetting("grok-bots-editor")}>
        {status.data?.installed !== true ? (
          <SettingsRow
            title="Bots"
            description="Set up the connection first. T3 Code lists bots from your Grok Bot account and does not add sample bots."
          />
        ) : status.data.sessionPresent !== true ? (
          <SettingsRow
            title="Bots"
            description="Sign in to Grok Bot, then refresh to load your bots."
          />
        ) : roster.error ? (
          <SettingsRow title="Could not load bots" description={roster.error} />
        ) : roster.isPending && roster.data === null ? (
          <SettingsRow title="Loading bots" description="Reading your Grok Bot account." />
        ) : bots.length === 0 ? (
          <SettingsRow
            title="No bots yet"
            description="Create bots in Grok Bot. They will show up here after you refresh."
          />
        ) : (
          <>
            {selected ? (
              <div className="px-3 py-4 sm:px-4">
                <GrokBotProfileEditor
                  key={grokBotSurfaceKey(environmentId, selected.id)}
                  environmentId={environmentId}
                  bot={selected}
                  projects={projects}
                />
              </div>
            ) : null}
          </>
        )}
      </SettingsSection>

      <SettingsSection title="Limits">
        <div className="px-3 py-3 sm:px-4">
          <GrokBotLimitations />
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}

function connectionCopy(
  status: { installed: boolean; managed: boolean; sessionPresent: boolean } | null,
  error: string | null,
  pending: boolean,
): string {
  if (error) return error;
  if (pending && status === null) return "Checking the Grok Bot connection.";
  if (status?.installed !== true) {
    return "Install the Grok Bot bridge for this environment, then sign in.";
  }
  if (status.sessionPresent !== true) {
    return "The bridge is installed. Sign in to Grok Bot, then refresh.";
  }
  return "Connected. Chats and bot lists come from your Grok Bot account.";
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { GrokBotConversationView } from "../components/grokBot/GrokBotConversationView";
import {
  grokBotSettingsDestinationSearch,
  grokBotSurfaceKey,
  resolveGrokBotSelectedEnvironment,
  validateGrokBotConversationSearch,
} from "../components/grokBot/grokBotPresentation";
import { useSelectedGrokBotEnvironmentId } from "../components/grokBot/useGrokBotEnvironment";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { useConnectedEnvironmentIds } from "../state/environments";

function GrokBotConversationRoute() {
  const { botId } = Route.useParams();
  const navigate = useNavigate();
  const selectedEnvironmentId = useSelectedGrokBotEnvironmentId();
  const connectedEnvironmentIds = useConnectedEnvironmentIds();
  const resolved = resolveGrokBotSelectedEnvironment({
    selectedEnvironmentId,
    connectedEnvironmentIds,
  });
  if (resolved.kind === "no-environment") {
    return (
      <Empty size="hero">
        <EmptyHeader>
          <EmptyTitle>Choose an environment</EmptyTitle>
          <EmptyDescription>Connect an environment to open this Grok Bot chat.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (resolved.kind === "disconnected") {
    return (
      <Empty size="hero">
        <EmptyHeader>
          <EmptyTitle>Reconnect this environment</EmptyTitle>
          <EmptyDescription>
            This Grok Bot chat stays with the selected environment. Reconnect it or choose a
            connected one.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void navigate({
              to: "/settings/grok-bots",
              search: grokBotSettingsDestinationSearch({
                environmentId: resolved.environmentId,
                botId,
              }),
              hash: "grok-bots-bridge",
            })
          }
        >
          Open settings
        </Button>
      </Empty>
    );
  }
  return (
    <GrokBotConversationView
      key={grokBotSurfaceKey(resolved.environmentId, botId)}
      environmentId={resolved.environmentId}
      botId={botId}
    />
  );
}

export const Route = createFileRoute("/_chat/grok-bots/$botId")({
  validateSearch: validateGrokBotConversationSearch,
  component: GrokBotConversationRoute,
});

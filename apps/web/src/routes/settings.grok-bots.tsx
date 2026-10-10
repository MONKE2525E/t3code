import { createFileRoute } from "@tanstack/react-router";

import { GrokBotSettings } from "../components/grokBot/GrokBotSettings";
import {
  retainGrokBotSettingsBotId,
  validateGrokBotSettingsSearch,
} from "../components/grokBot/grokBotPresentation";

function SettingsGrokBotsRoute() {
  const { botId } = Route.useSearch();
  return <GrokBotSettings botId={botId} />;
}

export const Route = createFileRoute("/settings/grok-bots")({
  validateSearch: validateGrokBotSettingsSearch,
  search: { middlewares: [retainGrokBotSettingsBotId] },
  component: SettingsGrokBotsRoute,
});

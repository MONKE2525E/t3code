import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, GrokBot } from "@t3tools/contracts";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { EllipsisIcon, EyeOffIcon, PinIcon, PinOffIcon, SettingsIcon } from "lucide-react";
import * as Schema from "effect/Schema";
import { useCallback, useMemo } from "react";

import { Collapsible, CollapsiblePanel } from "~/components/ui/collapsible";
import { CollapsibleSectionHeader } from "~/components/ui/collapsible-section-header";
import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { Skeleton } from "~/components/ui/skeleton";
import { SidebarGroup, useSidebar } from "~/components/ui/sidebar";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";
import { useConnectedEnvironmentIds } from "~/state/environments";
import { grokBotsListQuery, grokBotsStatusQuery, grokBotsUpdate } from "~/state/grokBots";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

import { GrokBotAvatar } from "./GrokBotAvatar";
import { useGrokBotActivity } from "./grokBotActivity";
import {
  grokBotSettingsDestinationSearch,
  grokBotSurfaceKey,
  partitionGrokBotRoster,
  resolveGrokBotSelectedEnvironment,
} from "./grokBotPresentation";
import { useSelectedGrokBotEnvironmentId } from "./useGrokBotEnvironment";

const GROK_BOTS_OPEN_STORAGE_KEY = "t3code:grok-bots-sidebar-open";

export function GrokBotSidebarDropdown() {
  const selectedEnvironmentId = useSelectedGrokBotEnvironmentId();
  const connectedEnvironmentIds = useConnectedEnvironmentIds();
  const resolved = resolveGrokBotSelectedEnvironment({
    selectedEnvironmentId,
    connectedEnvironmentIds,
  });
  const environmentId = resolved.kind === "environment" ? resolved.environmentId : null;
  const [open, setOpen] = useLocalStorage(GROK_BOTS_OPEN_STORAGE_KEY, true, Schema.Boolean);
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const status = useEnvironmentQuery(
    environmentId === null ? null : grokBotsStatusQuery({ environmentId, input: {} }),
  );
  const ready = status.data?.installed === true && status.data.sessionPresent === true;
  const roster = useEnvironmentQuery(
    environmentId !== null && ready ? grokBotsListQuery({ environmentId, input: {} }) : null,
  );
  const { pinned, rows } = useMemo(() => partitionGrokBotRoster(roster.data ?? []), [roster.data]);
  const location = useLocation();
  const selectedBotId = location.pathname.startsWith("/grok-bots/")
    ? decodeURIComponent(location.pathname.slice("/grok-bots/".length).split("/")[0] ?? "")
    : null;

  const openBot = useCallback(
    (botId: string) => {
      if (isMobile) setOpenMobile(false);
      void navigate({
        to: "/grok-bots/$botId",
        params: { botId },
        search: environmentId ? { environmentId } : {},
      });
    },
    [environmentId, isMobile, navigate, setOpenMobile],
  );

  const openSettings = useCallback(
    (botId?: string) => {
      if (isMobile) setOpenMobile(false);
      void navigate({
        to: "/settings/grok-bots",
        search: grokBotSettingsDestinationSearch({
          environmentId: selectedEnvironmentId,
          botId,
        }),
        hash: botId ? "grok-bots-editor" : "grok-bots-bridge",
      });
    },
    [isMobile, navigate, selectedEnvironmentId, setOpenMobile],
  );

  return (
    <SidebarGroup className="z-[1] -mt-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleSectionHeader expanded={open} tone="muted" onClick={() => setOpen(!open)}>
          Grok Bots
        </CollapsibleSectionHeader>
        <CollapsiblePanel>
          <div className="mt-0.5 max-h-72 overflow-y-auto">
            {resolved.kind === "no-environment" ? (
              <p className="px-2 py-2 text-xs text-sidebar-muted-foreground">
                Connect an environment to use Grok Bots.
              </p>
            ) : resolved.kind === "disconnected" ? (
              <GrokBotSidebarNotice
                message="This environment is unavailable. Reconnect it or choose a connected one."
                actionLabel="Open settings"
                onAction={() => openSettings()}
              />
            ) : status.isPending && status.data === null ? (
              <div className="flex flex-col gap-2 px-1 py-1">
                <Skeleton className="h-16 w-full" shape="card" />
                <Skeleton className="h-10 w-full" shape="card" />
              </div>
            ) : status.error ? (
              <GrokBotSidebarNotice
                message={status.error}
                actionLabel="Open settings"
                onAction={() => openSettings()}
              />
            ) : status.data?.installed !== true ? (
              <GrokBotSidebarNotice
                message="Set up the Grok Bot connection to chat with your bots here."
                actionLabel="Set up"
                onAction={() => openSettings()}
              />
            ) : status.data.sessionPresent !== true ? (
              <GrokBotSidebarNotice
                message="Open Grok Bot and sign in, then refresh the connection."
                actionLabel="Refresh"
                onAction={() => {
                  status.refresh();
                  roster.refresh();
                }}
                secondaryLabel="Settings"
                onSecondary={() => openSettings()}
              />
            ) : roster.isPending && roster.data === null ? (
              <div className="flex flex-col gap-2 px-1 py-1">
                <Skeleton className="h-16 w-full" shape="card" />
                <Skeleton className="h-10 w-full" shape="card" />
              </div>
            ) : roster.error ? (
              <GrokBotSidebarNotice
                message={roster.error}
                actionLabel="Retry"
                onAction={() => roster.refresh()}
              />
            ) : pinned.length === 0 && rows.length === 0 ? (
              <GrokBotSidebarNotice
                message="No bots to show. Hidden bots stay in Settings."
                actionLabel="Settings"
                onAction={() => openSettings()}
              />
            ) : (
              <div className="flex flex-col gap-1">
                {pinned.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-px pb-1">
                    {pinned.map((bot) => (
                      <li key={bot.id}>
                        <GrokBotPinnedTile
                          bot={bot}
                          selected={bot.id === selectedBotId}
                          environmentId={resolved.environmentId}
                          onOpen={() => openBot(bot.id)}
                          onEdit={() => openSettings(bot.id)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ul className="flex flex-col gap-px">
                  {rows.map((bot) => (
                    <li key={bot.id}>
                      <GrokBotRosterRow
                        bot={bot}
                        selected={bot.id === selectedBotId}
                        environmentId={resolved.environmentId}
                        onOpen={() => openBot(bot.id)}
                        onEdit={() => openSettings(bot.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarGroup>
  );
}

function GrokBotSidebarNotice({
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  readonly message: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly secondaryLabel?: string;
  readonly onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <p className="text-xs leading-4.5 text-sidebar-muted-foreground">{message}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button size="xs" variant="ghost" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GrokBotRosterRow({
  bot,
  selected,
  environmentId,
  onOpen,
  onEdit,
}: {
  readonly bot: GrokBot;
  readonly selected: boolean;
  readonly environmentId: EnvironmentId;
  readonly onOpen: () => void;
  readonly onEdit: () => void;
}) {
  const activity = useGrokBotActivity(grokBotSurfaceKey(environmentId, bot.id));
  return (
    <div
      className={cn(
        "group/sidebar-row group/bot relative w-full overflow-hidden rounded-md text-sidebar-foreground",
        selected ? "bg-sidebar-row-active" : "hover:bg-sidebar-row-hover",
      )}
    >
      <button
        type="button"
        aria-current={selected ? "page" : undefined}
        className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 px-(--sidebar-row-content-inset) py-1.5 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onOpen}
      >
        <GrokBotAvatar bot={bot} size="sm" featured={bot.featured} state={activity} />
        <span className="min-w-0 flex-1">
          <span className="flex h-5 min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-sm">{bot.name}</span>
            {bot.label.trim().length > 0 ? (
              <span className="max-w-[45%] shrink truncate rounded-sm bg-sidebar-control-surface px-1 text-3xs leading-4 text-secondary-label">
                {bot.label}
              </span>
            ) : null}
          </span>
          {bot.description.trim().length > 0 ? (
            <span className="block truncate text-xs text-secondary-label">{bot.description}</span>
          ) : null}
        </span>
      </button>
      <GrokBotRowMenu
        bot={bot}
        environmentId={environmentId}
        onEdit={onEdit}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-hover/bot:opacity-100 group-focus-within/bot:opacity-100 has-data-popup-open:opacity-100"
      />
    </div>
  );
}

function GrokBotPinnedTile({
  bot,
  selected,
  environmentId,
  onOpen,
  onEdit,
}: {
  readonly bot: GrokBot;
  readonly selected: boolean;
  readonly environmentId: EnvironmentId;
  readonly onOpen: () => void;
  readonly onEdit: () => void;
}) {
  const activity = useGrokBotActivity(grokBotSurfaceKey(environmentId, bot.id));
  return (
    <div
      className={cn(
        "group/sidebar-row group/bot relative rounded-lg text-sidebar-foreground",
        selected ? "bg-sidebar-row-active" : "hover:bg-sidebar-row-hover",
      )}
    >
      <button
        type="button"
        aria-current={selected ? "page" : undefined}
        className="flex w-full min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg px-1.5 py-2.5 text-center outline-none select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onOpen}
      >
        <GrokBotAvatar bot={bot} size="lg" featured={bot.featured} state={activity} />
        <span className="w-full truncate text-xs">{bot.name}</span>
        {bot.label.trim().length > 0 ? (
          <span className="max-w-full truncate rounded-sm bg-sidebar-control-surface px-1 text-3xs leading-4 text-secondary-label">
            {bot.label}
          </span>
        ) : null}
      </button>
      <GrokBotRowMenu
        bot={bot}
        environmentId={environmentId}
        onEdit={onEdit}
        className="absolute top-1 right-1 opacity-0 group-hover/bot:opacity-100 group-focus-within/bot:opacity-100 has-data-popup-open:opacity-100"
      />
    </div>
  );
}

function GrokBotRowMenu({
  bot,
  environmentId,
  onEdit,
  className,
}: {
  readonly bot: GrokBot;
  readonly environmentId: EnvironmentId;
  readonly onEdit: () => void;
  readonly className?: string;
}) {
  const canUpdate = useAtomValue(grokBotsUpdate.permissionAtom(environmentId));
  const updateBot = useAtomCommand(grokBotsUpdate, { reportFailure: true });

  return (
    <div className={className}>
      <Menu>
        <MenuTrigger
          render={<Button size="icon-micro" variant="ghost" aria-label={`Edit ${bot.name}`} />}
        >
          <EllipsisIcon />
        </MenuTrigger>
        <MenuPopup align="end" side="bottom">
          <MenuItem
            disabled={!canUpdate}
            onClick={() =>
              void updateBot({
                environmentId,
                input: { botId: bot.id, pinned: !bot.pinned },
              })
            }
          >
            {bot.pinned ? <PinOffIcon /> : <PinIcon />}
            {bot.pinned ? "Unpin" : "Pin"}
          </MenuItem>
          <MenuItem
            disabled={!canUpdate}
            onClick={() =>
              void updateBot({
                environmentId,
                input: { botId: bot.id, hidden: !bot.hidden },
              })
            }
          >
            <EyeOffIcon />
            {bot.hidden ? "Show in list" : "Hide"}
          </MenuItem>
          <MenuItem onClick={onEdit}>
            <SettingsIcon />
            Edit
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}

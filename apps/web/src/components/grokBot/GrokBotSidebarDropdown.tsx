import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, GrokBot } from "@t3tools/contracts";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { EllipsisIcon, EyeOffIcon, PinIcon, SettingsIcon, StarIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { CollapsibleSectionHeader } from "~/components/ui/collapsible-section-header";
import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { Skeleton } from "~/components/ui/skeleton";
import { SidebarGroup, useSidebar } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";
import { useConnectedEnvironmentIds } from "~/state/environments";
import { grokBotsListQuery, grokBotsStatusQuery, grokBotsUpdate } from "~/state/grokBots";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

import { GrokBotAvatar } from "./GrokBotAvatar";
import {
  grokBotSettingsDestinationSearch,
  partitionGrokBotRoster,
  resolveGrokBotSelectedEnvironment,
} from "./grokBotPresentation";
import { useSelectedGrokBotEnvironmentId } from "./useGrokBotEnvironment";

export function GrokBotSidebarDropdown() {
  const selectedEnvironmentId = useSelectedGrokBotEnvironmentId();
  const connectedEnvironmentIds = useConnectedEnvironmentIds();
  const resolved = resolveGrokBotSelectedEnvironment({
    selectedEnvironmentId,
    connectedEnvironmentIds,
  });
  const environmentId = resolved.kind === "environment" ? resolved.environmentId : null;
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const status = useEnvironmentQuery(
    environmentId === null ? null : grokBotsStatusQuery({ environmentId, input: {} }),
  );
  const ready = status.data?.installed === true && status.data.sessionPresent === true;
  const roster = useEnvironmentQuery(
    environmentId !== null && ready ? grokBotsListQuery({ environmentId, input: {} }) : null,
  );
  const { featured, rows } = useMemo(
    () => partitionGrokBotRoster(roster.data ?? []),
    [roster.data],
  );
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
    <SidebarGroup className="z-[1]">
      <CollapsibleSectionHeader
        expanded={open}
        tone="muted"
        onClick={() => setOpen((current) => !current)}
      >
        Grok Bots
      </CollapsibleSectionHeader>
      {open ? (
        <div className="mt-1 max-h-72 overflow-y-auto pr-0.5">
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
          ) : featured.length === 0 && rows.length === 0 ? (
            <GrokBotSidebarNotice
              message="No bots to show. Hidden bots stay in Settings."
              actionLabel="Settings"
              onAction={() => openSettings()}
            />
          ) : (
            <div className="flex flex-col gap-2 pb-1">
              {featured.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 px-0.5">
                  {featured.map((bot) => (
                    <GrokBotFeaturedTile
                      key={bot.id}
                      bot={bot}
                      selected={bot.id === selectedBotId}
                      environmentId={resolved.environmentId}
                      onOpen={() => openBot(bot.id)}
                      onEdit={() => openSettings(bot.id)}
                    />
                  ))}
                </div>
              ) : null}
              {rows.length > 0 ? (
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
              ) : null}
            </div>
          )}
        </div>
      ) : null}
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

function GrokBotFeaturedTile({
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
  return (
    <div
      className={cn(
        "group/bot relative flex flex-col items-center rounded-lg px-1.5 py-2 text-center hover:bg-sidebar-row-hover",
        selected && "bg-sidebar-row-selected text-sidebar-foreground",
      )}
    >
      <button
        type="button"
        className="flex w-full flex-col items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onOpen}
      >
        <GrokBotAvatar bot={bot} size="md" featured={bot.featured} />
        <span className="w-full truncate text-xs font-medium text-sidebar-foreground">
          {bot.name}
        </span>
        {bot.label.trim().length > 0 ? (
          <span className="max-w-full truncate rounded-sm bg-sidebar-control-surface px-1 py-px text-3xs leading-3 text-sidebar-muted-foreground">
            {bot.label}
          </span>
        ) : null}
      </button>
      <GrokBotRowMenu
        bot={bot}
        environmentId={environmentId}
        onEdit={onEdit}
        className="absolute top-1 right-1 opacity-0 group-hover/bot:opacity-100 group-focus-within/bot:opacity-100 data-popup-open:opacity-100"
      />
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
  return (
    <div
      className={cn(
        "group/bot relative flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-sidebar-row-hover",
        selected && "bg-sidebar-row-selected text-sidebar-foreground",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onOpen}
      >
        <GrokBotAvatar bot={bot} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-sidebar-foreground">{bot.name}</span>
            {bot.label.trim().length > 0 ? (
              <span className="max-w-24 truncate rounded-sm bg-sidebar-control-surface px-1 py-px text-3xs leading-3 text-sidebar-muted-foreground">
                {bot.label}
              </span>
            ) : null}
          </span>
          {bot.description.trim().length > 0 ? (
            <span className="block truncate text-xs text-sidebar-muted-foreground">
              {bot.description}
            </span>
          ) : null}
        </span>
      </button>
      <GrokBotRowMenu
        bot={bot}
        environmentId={environmentId}
        onEdit={onEdit}
        className="opacity-0 group-hover/bot:opacity-100 group-focus-within/bot:opacity-100 data-popup-open:opacity-100"
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
                input: { botId: bot.id, featured: !bot.featured },
              })
            }
          >
            <StarIcon />
            {bot.featured ? "Remove from featured" : "Feature"}
          </MenuItem>
          <MenuItem
            disabled={!canUpdate}
            onClick={() =>
              void updateBot({
                environmentId,
                input: { botId: bot.id, pinned: !bot.pinned },
              })
            }
          >
            <PinIcon />
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

import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { type AppSymbolName, SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { cn } from "../../lib/cn";
import { useUniwindTheme } from "../../lib/useUniwindTheme";

export function PrIconButton(props: {
  icon: AppSymbolName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const iconColor = String(useUniwindTheme()["--color-icon"]);
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled || props.busy, busy: props.busy }}
      disabled={props.disabled || props.busy}
      hitSlop={4}
      onPress={props.onPress}
      className={cn(
        "size-11 items-center justify-center rounded-full active:bg-subtle-strong",
        props.disabled && "opacity-45",
      )}
    >
      {props.busy ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <SymbolView name={props.icon} size={19} tintColor={iconColor} type="monochrome" />
      )}
    </Pressable>
  );
}

export function PrButton(props: {
  label: string;
  onPress: () => void;
  icon?: AppSymbolName;
  variant?: "outline" | "primary";
  disabled?: boolean;
  busy?: boolean;
  className?: string;
}) {
  const primary = props.variant === "primary";
  const foreground = String(useUniwindTheme()["--color-foreground"]);
  const onPrimary = String(useUniwindTheme()["--color-primary-foreground"]);
  const tint = primary ? onPrimary : foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled || props.busy, busy: props.busy }}
      disabled={props.disabled || props.busy}
      onPress={props.onPress}
      className={cn(
        "min-h-11 flex-row items-center justify-center gap-1.5 rounded-lg px-4",
        primary ? "bg-primary active:opacity-80" : "border border-input-border active:bg-subtle",
        (props.disabled || props.busy) && "opacity-50",
        props.className,
      )}
    >
      {props.busy ? (
        <ActivityIndicator size="small" color={tint} />
      ) : props.icon ? (
        <SymbolView name={props.icon} size={15} tintColor={tint} type="monochrome" />
      ) : null}
      <Text
        className={cn(
          "text-sm font-t3-medium",
          primary ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/** A selectable pill, used for single-choice groups where every option should stay visible. */
export function PrChoice(props: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected, disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      className={cn(
        "min-h-11 justify-center rounded-full border px-4",
        props.selected ? "border-primary bg-primary" : "border-input-border active:bg-subtle",
        props.disabled && "opacity-45",
      )}
    >
      <Text
        className={cn(
          "text-sm",
          props.selected ? "font-t3-medium text-primary-foreground" : "text-foreground",
        )}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/**
 * The page-sized state: nothing to list, nothing loaded, or a failure with a way out. Centered in
 * the space the content would have used, with the one action that can change the outcome.
 */
export function PrStateMessage(props: {
  icon: AppSymbolName;
  title: string;
  message?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  const iconColor = String(useUniwindTheme()["--color-icon-muted"]);
  return (
    <View className="flex-1 items-center justify-center px-8 py-10">
      <View className="mb-4 size-11 items-center justify-center rounded-xl border border-border bg-card">
        {props.loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <SymbolView name={props.icon} size={20} tintColor={iconColor} type="monochrome" />
        )}
      </View>
      <Text className="text-center text-base font-t3-bold text-foreground">{props.title}</Text>
      {props.message ? (
        <Text
          selectable
          className="mt-1.5 max-w-[320px] text-center text-sm leading-5 text-foreground-muted"
        >
          {props.message}
        </Text>
      ) : null}
      {props.children ? (
        <View className="mt-5 flex-row flex-wrap justify-center gap-2">{props.children}</View>
      ) : null}
    </View>
  );
}

/** A problem worth a line above content that did load. Lines are shown as given. */
export function PrNotice(props: {
  lines: ReadonlyArray<string>;
  actionLabel?: string;
  onAction?: () => void;
  /** Drops the outer margin where the parent already pads its content. */
  flush?: boolean;
}) {
  const warning = String(useUniwindTheme()["--color-danger-foreground"]);
  if (props.lines.length === 0) return null;
  return (
    <View
      accessibilityRole="alert"
      className={cn(
        "flex-row items-start gap-2.5 rounded-lg border border-danger-border bg-danger px-3 py-2.5",
        !props.flush && "mx-3 mb-2",
      )}
    >
      <View className="pt-0.5">
        <SymbolView
          name="exclamationmark.triangle"
          size={15}
          tintColor={warning}
          type="monochrome"
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        {props.lines.map((line) => (
          <Text key={line} selectable className="text-[13px] leading-[18px] text-danger-foreground">
            {line}
          </Text>
        ))}
      </View>
      {props.actionLabel && props.onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          onPress={props.onAction}
        >
          <Text className="text-[13px] font-t3-bold text-danger-foreground">
            {props.actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrTabs<Key extends string>(props: {
  tabs: ReadonlyArray<{ key: Key; label: string; badge?: string | number | undefined }>;
  selected: Key;
  onSelect: (key: Key) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row border-b border-border px-1">
      {props.tabs.map((tab) => {
        const selected = tab.key === props.selected;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => props.onSelect(tab.key)}
            className="min-h-11 flex-1 items-center justify-center"
          >
            <View className="flex-row items-center gap-1.5">
              <Text
                className={cn(
                  "text-sm",
                  selected ? "font-t3-bold text-foreground" : "text-foreground-muted",
                )}
              >
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge !== "" ? (
                <Text className="text-xs text-foreground-tertiary">{tab.badge}</Text>
              ) : null}
            </View>
            {selected ? (
              <View className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-foreground" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

import { cn } from "~/lib/utils";

export function GrokBotLimitations({ className }: { readonly className?: string }) {
  return (
    <p className={cn("text-xs leading-5 text-muted-foreground", className)}>
      Chats stay with Grok Bot. Pull request links attach an existing GitHub pull request; they do
      not create one. Timezone, auto-review, usage, and remote computer controls are not available
      here yet.
    </p>
  );
}

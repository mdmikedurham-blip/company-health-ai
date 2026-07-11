/**
 * Playbook registry — Map-based, no switch/case in consumers.
 */

import type { PlaybookId } from "@/lib/domain/playbook";
import { DEFAULT_PLAYBOOK } from "@/lib/domain/playbook";
import type { PlaybookProvider } from "./provider";
import { toPlaybookMeta } from "./provider";

const providers = new Map<PlaybookId, PlaybookProvider>();

export function registerPlaybookProvider(provider: PlaybookProvider): void {
  providers.set(provider.id, provider);
}

export function getPlaybookProvider(
  playbookId?: PlaybookId | null,
): PlaybookProvider {
  const id = playbookId ?? DEFAULT_PLAYBOOK;
  const provider = providers.get(id);
  if (!provider) {
    const fallback = providers.get(DEFAULT_PLAYBOOK);
    if (!fallback) {
      throw new Error(
        `Playbook provider not registered: ${id} (and default missing)`,
      );
    }
    return fallback;
  }
  return provider;
}

export function listPlaybookProviders(): PlaybookProvider[] {
  return [...providers.values()];
}

export function listPlaybookMetas() {
  return listPlaybookProviders().map(toPlaybookMeta);
}

export function hasPlaybookProvider(playbookId: PlaybookId): boolean {
  return providers.has(playbookId);
}

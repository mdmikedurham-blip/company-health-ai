/**
 * Resolve the EvidenceRepository implementation for the current environment.
 * Prefer Supabase when configured; otherwise use the shared in-memory store.
 */

import { isSupabaseConfigured, type AppSupabaseClient } from "@/lib/supabase";
import type { EvidenceRepository } from "./evidence-repository";
import {
  getSharedInMemoryEvidenceRepository,
  InMemoryEvidenceRepository,
} from "./in-memory-evidence-repository";
import { SupabaseEvidenceRepository } from "./supabase-evidence-repository";

export type CreateEvidenceRepositoryOptions = {
  /** Force in-memory even when Supabase is configured (tests). */
  preferInMemory?: boolean;
  /** Inject a Supabase client (service role). */
  client?: AppSupabaseClient;
  /** Inject a custom repository. */
  repository?: EvidenceRepository;
};

export function createEvidenceRepository(
  options?: CreateEvidenceRepositoryOptions,
): EvidenceRepository {
  if (options?.repository) return options.repository;

  if (options?.preferInMemory) {
    return new InMemoryEvidenceRepository();
  }

  if (isSupabaseConfigured()) {
    return new SupabaseEvidenceRepository(options?.client);
  }

  return getSharedInMemoryEvidenceRepository();
}

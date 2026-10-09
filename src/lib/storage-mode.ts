/**
 * Local is the default for single-computer use.
 * Set RECEBEU_STORAGE=supabase when migrating to hosted multi-user mode.
 */
export const isLocalMode = process.env.RECEBEU_STORAGE !== "supabase";

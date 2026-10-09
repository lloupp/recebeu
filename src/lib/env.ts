function required(name: string, value: string | undefined) {
  if (!value) throw new Error("Variável de ambiente ausente: " + name);
  return value;
}

// Defer credentials validation until the hosted Supabase adapter is used.
// The local SQLite workflow must run with no Supabase .env at all.
export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  },
};

import LoginPageClient from './LoginPageClient';

// Render the username field in server HTML, so older TV WebViews do not
// need to hydrate React before showing the account/password form.
export const dynamic = 'force-dynamic';

function safeRedirect(candidate: unknown): string {
  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    candidate.includes('\r') ||
    candidate.includes('\n')
  ) {
    return '/';
  }
  return candidate;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string; error?: string }>;
}) {
  const query = await searchParams;
  const shouldAskUsername =
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') !== 'localstorage';

  return (
    <LoginPageClient
      shouldAskUsername={shouldAskUsername}
      redirect={safeRedirect(query?.redirect)}
      initialError={query?.error || null}
    />
  );
}

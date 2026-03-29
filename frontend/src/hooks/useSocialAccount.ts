// hooks/useSocialAccount.ts

if (account.requires_reauth || account.status === "disconnected") {
  return <ReconnectBanner account={account} />;
}
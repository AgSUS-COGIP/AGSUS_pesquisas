export function CddiScrollBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="cddi-route-shell">{children}</div>;
}

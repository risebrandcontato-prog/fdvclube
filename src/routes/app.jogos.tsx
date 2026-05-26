import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/jogos")({
  component: JogosLayout,
});

function JogosLayout() {
  return (
    <div className="min-h-screen bg-background pb-10">
      <Outlet />
    </div>
  );
}
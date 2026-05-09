import { createFileRoute } from "@tanstack/react-router";
import CareerBuddy from "@/components/CareerBuddy";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Career-Buddy — Land your first startup role" },
      { name: "description", content: "Application tracker for business-background grads chasing Founders Associate, BizOps, Strategy and BD roles." },
    ],
  }),
});

function Index() {
  return <CareerBuddy />;
}

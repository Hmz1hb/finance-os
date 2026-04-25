import { Bot } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function AIPage() {
  const [conversations, insights] = await Promise.all([
    prisma.aIConversation.findMany({ orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []),
    prisma.aIInsight.findMany({ orderBy: { generatedAt: "desc" }, take: 30 }).catch(() => []),
  ]);
  return (
    <>
      <PageHeader title="AI financial advisor" description="Claude Sonnet on Bedrock with compact financial context, allocation planning, receipt parsing, and insights." badge="Bedrock" />
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> Capabilities</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2">
            {["Smart allocation", "Tax estimates", "Subscription review", "Debt payoff", "Hiring affordability", "Health score", "Receipt OCR"].map((item) => <Badge key={item}>{item}</Badge>)}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stored conversations</CardTitle></CardHeader>
          <div className="space-y-2">
            {conversations.map((conversation) => <div key={conversation.id} className="rounded-md bg-surface-inset p-3 text-sm">{conversation.title}</div>)}
            {conversations.length === 0 ? <p className="text-sm text-muted-ledger">Use the floating advisor button to start the first conversation.</p> : null}
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Insights feed</CardTitle></CardHeader>
          <div className="space-y-2">
            {insights.map((insight) => <div key={insight.id} className="rounded-md bg-surface-inset p-3"><p className="text-sm font-medium">{insight.type}</p><p className="text-sm text-muted-ledger">{insight.content}</p></div>)}
            {insights.length === 0 ? <p className="text-sm text-muted-ledger">Generate weekly or monthly insights from the API once transactions exist.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}

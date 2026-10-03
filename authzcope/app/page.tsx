import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <Badge variant="secondary">Scaffold</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Authzcope</h1>
        <p className="text-muted-foreground">
          Understand your application’s authorization model in its own language.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Access, with context</CardTitle>
          <CardDescription>
            Connect domain intent to policies, functions, and database evidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Database connection setup and analysis will be added here next.</p>
        </CardContent>
      </Card>
    </main>
  );
}

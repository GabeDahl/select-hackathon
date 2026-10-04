import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function ScaffoldPage({
  title,
  emptyTitle,
  emptyDescription,
  icon: Icon,
  nextHref,
  nextLabel,
}: {
  title: string;
  emptyTitle: string;
  emptyDescription?: string;
  icon: LucideIcon;
  nextHref: string;
  nextLabel: string;
}) {
  return (
    <>
      <PageHeader title={title} />
      <Empty className="min-h-80 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          {emptyDescription ? <EmptyDescription>{emptyDescription}</EmptyDescription> : null}
        </EmptyHeader>
        <EmptyContent>
          <Link href={nextHref} className={cn(buttonVariants({ variant: "outline" }))}>
            {nextLabel}
          </Link>
        </EmptyContent>
      </Empty>
    </>
  );
}

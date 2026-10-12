import { ArrowUpRight, MapPin, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface BusinessCardData {
  name: string;
  type: string;
  area: string;
  address?: string;
  phoneHref?: string;
  directionsHref?: string;
  verified?: boolean;
}

export function BusinessCard({ business }: { business: BusinessCardData }) {
  return (
    <Card className="h-full">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{business.name}</CardTitle>
          {business.verified && <Badge variant="success">Verified</Badge>}
        </div>
        <p className="text-sm text-slate-600">{business.type}</p>
      </CardHeader>
      <CardContent>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin
            aria-hidden="true"
            className="size-4 shrink-0 text-teal-800"
          />
          <span>{business.address ?? business.area}</span>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {business.phoneHref && (
            <Button asChild variant="secondary" size="sm">
              <a href={business.phoneHref}>
                <Phone aria-hidden="true" className="size-4" />
                Call
              </a>
            </Button>
          )}
          {business.directionsHref && (
            <Button asChild variant="outline" size="sm">
              <a
                href={business.directionsHref}
                target="_blank"
                rel="noreferrer"
              >
                Directions
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { ArrowUpRight, MapPin, MessageCircle, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicBusinessRow } from "@/services/business-directory";

export function BusinessDirectoryCard({
  business,
}: {
  business: PublicBusinessRow;
}) {
  const address = [
    business.address_line1,
    business.address_line2,
    business.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const directionsUrl =
    business.latitude !== null && business.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.business_name}, ${address}`)}`;
  const whatsappNumber = business.whatsapp_e164?.replace(/[^0-9]/g, "");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{business.business_name}</CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              {business.business_type}
            </p>
          </div>
          <Badge variant="success">Verified partner</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-600">
          <MapPin
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-teal-800"
          />
          <span>{address}</span>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/pharmacies/${encodeURIComponent(business.business_slug)}`}
            >
              View profile
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <a href={`tel:${business.phone_e164}`}>
              <Phone aria-hidden="true" className="size-4" />
              Call
            </a>
          </Button>
          {whatsappNumber && (
            <Button asChild size="sm" variant="ghost">
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                WhatsApp
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <a href={directionsUrl} target="_blank" rel="noreferrer">
              Directions
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

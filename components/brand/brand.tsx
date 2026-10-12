import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
    >
      <Image
        src="/dawasetu-mark.jpeg"
        alt=""
        width={52}
        height={52}
        priority
        className="size-11 rounded-xl object-cover sm:size-13"
      />
      <span className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-slate-900">
          DawaSetu
        </span>
        {!compact && (
          <span className="text-[0.65rem] font-semibold tracking-[0.14em] text-teal-800 uppercase">
            India’s medicine availability network
          </span>
        )}
      </span>
    </Link>
  );
}

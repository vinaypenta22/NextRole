"use client";

import Link from "next/link";
import Image from "next/image";

type LogoProps = {
  className?: string;
  iconOnly?: boolean;
};

export default function Logo({
  className = "",
  iconOnly = false,
}: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center hover:opacity-90 transition ${className}`}
    >
      <Image
        src={!iconOnly ? "/navbarlogo.png" : "/loginlogo.png"}
        alt="NextRole Logo"
        width={iconOnly ? 40 : 180}
        height={iconOnly ? 40 : 50}
        priority
        className="object-contain"
      />
    </Link>
  );
}
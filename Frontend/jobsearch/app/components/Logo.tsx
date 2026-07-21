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
      className={`inline-flex items-center transition duration-200 hover:opacity-90 ${className}`}
    >
      <Image
        src={!iconOnly ? "/navbarlogo.png" : "/loginlogo.png"}
        alt="Logo"
        width={iconOnly ? 40 : 250}
        height={iconOnly ? 40 : 70}
        priority
        className="object-contain"
      />
    </Link>
  );
}

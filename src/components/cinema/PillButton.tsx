import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "soft";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  href: string;
};

function variantClass(v: Variant | undefined) {
  return v === "soft" ? "pill-cta-soft" : "pill-cta";
}

export const PillButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function PillButton({ variant, className, ...rest }, ref) {
    return (
      <button ref={ref} className={cn(variantClass(variant), className)} {...rest} />
    );
  },
);

/** Link-flavoured pill — preserve native `<a>` semantics for navigation. */
export const PillLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function PillLink({ variant, className, ...rest }, ref) {
    return (
      <a ref={ref} className={cn(variantClass(variant), className)} {...rest} />
    );
  },
);

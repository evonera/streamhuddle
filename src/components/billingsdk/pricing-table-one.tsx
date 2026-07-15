"use client";

import Tick01Icon from "@hugeicons/core-free-icons/Tick01Icon";
import FlashIcon from "@hugeicons/core-free-icons/FlashIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useId } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { type Plan } from "@/lib/billingsdk-config";
import { cn } from "@/lib/utils";

const sectionVariants = cva("py-32", {
  variants: {
    size: {
      small: "py-6 md:py-12",
      medium: "py-10 md:py-20",
      large: "py-16 md:py-32",
    },
    theme: {
      minimal: "",
      classic:
        "bg-gradient-to-b from-background to-muted/20 relative overflow-hidden",
    },
  },
  defaultVariants: {
    size: "medium",
    theme: "minimal",
  },
});

const titleVariants = cva("text-pretty text-left font-bold", {
  variants: {
    size: {
      small: "text-3xl lg:text-4xl",
      medium: "text-4xl lg:text-5xl",
      large: "text-4xl lg:text-6xl",
    },
    theme: {
      minimal: "",
      classic:
        "text-center bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent p-1",
    },
  },
  defaultVariants: {
    size: "large",
    theme: "minimal",
  },
});

const descriptionVariants = cva("text-muted-foreground max-w-3xl", {
  variants: {
    size: {
      small: "text-base lg:text-lg",
      medium: "text-lg lg:text-xl",
      large: "lg:text-xl",
    },
    theme: {
      minimal: "text-left",
      classic: "text-center mx-auto",
    },
  },
  defaultVariants: {
    size: "large",
    theme: "minimal",
  },
});

const cardVariants = cva(
  "flex w-full flex-col rounded-xl border text-left h-full transition-all duration-500",
  {
    variants: {
      size: {
        small: "p-4",
        medium: "p-6",
        large: "p-8",
      },
      theme: {
        minimal: "",
        classic: "hover:-translate-y-2 hover:shadow-[0_0_40px_-15px_rgba(255,255,255,0.1)] backdrop-blur-xl bg-background/40 border-white/10 dark:bg-black/40 dark:border-white/10 shadow-2xl",
      },
      highlight: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        theme: "classic",
        highlight: true,
        className:
          "ring-1 ring-primary/50 border-primary/50 bg-gradient-to-b from-primary/10 to-background/40 relative overflow-hidden shadow-[0_0_40px_-15px_rgba(var(--primary),0.3)]",
      },
      {
        theme: "minimal",
        highlight: true,
        className: "bg-muted",
      },
    ],
    defaultVariants: {
      size: "large",
      theme: "minimal",
      highlight: false,
    },
  },
);

const priceTextVariants = cva("font-medium", {
  variants: {
    size: {
      small: "text-3xl",
      medium: "text-4xl",
      large: "text-4xl",
    },
    theme: {
      minimal: "",
      classic:
        "text-5xl font-extrabold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent",
    },
  },
  defaultVariants: {
    size: "large",
    theme: "minimal",
  },
});

const featureIconVariants = cva("flex-none h-[1lh]", {
  variants: {
    size: {
      small: "size-3",
      medium: "size-4",
      large: "size-4",
    },
    theme: {
      minimal: "text-primary",
      classic: "text-emerald-500",
    },
  },
  defaultVariants: {
    size: "large",
    theme: "minimal",
  },
});

const highlightBadgeVariants = cva("mb-8 block w-fit", {
  variants: {
    theme: {
      minimal: "",
      classic:
        "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.3)]",
    },
  },
  defaultVariants: {
    theme: "minimal",
  },
});

const toggleVariants = cva(
  "flex w-fit shrink-0 items-center rounded-lg p-1 text-base",
  {
    variants: {
      theme: {
        minimal: "bg-muted",
        classic:
          "bg-muted/50 backdrop-blur-sm border border-border/50 shadow-lg",
      },
    },
    defaultVariants: {
      theme: "minimal",
    },
  },
);

const buttonVariants = cva(
  "gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-300",
  {
    variants: {
      theme: {
        minimal:
          "shadow hover:bg-primary/90 h-9 py-2 group bg-primary text-primary-foreground ring-primary before:from-primary-foreground/20 after:from-primary-foreground/10 relative isolate inline-flex w-full items-center justify-center overflow-hidden rounded-md px-3 text-left text-sm font-medium ring-1 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-b before:opacity-80 before:transition-opacity before:duration-300 before:ease-[cubic-bezier(0.4,0.36,0,1)] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:bg-gradient-to-b after:to-transparent after:mix-blend-overlay hover:cursor-pointer",
        classic:
          "relative overflow-hidden bg-primary text-primary-foreground font-bold py-3 px-6 rounded-lg hover:shadow-[0_0_30px_rgba(var(--primary),0.4)] hover:scale-[1.02] active:scale-95 border border-primary/50 transition-all duration-300",
      },
    },
    defaultVariants: {
      theme: "minimal",
    },
  },
);

export interface PricingTableOneProps extends VariantProps<
  typeof sectionVariants
> {
  className?: string;
  plans: Plan[];
  title?: string;
  description?: string;
  onPlanSelect?: (planId: string) => void;
}

export function PricingTableOne({
  className,
  plans,
  title,
  description,
  onPlanSelect,
  size,
  theme = "minimal",
}: PricingTableOneProps) {
  const [isAnnually, setIsAnnually] = useState(false);
  const uniqueId = useId(); // Generate unique ID automatically



  return (
    <section className={cn(sectionVariants({ size, theme }), className)}>
      {/* Classic theme background elements */}
      {theme === "classic" && (
        <>
          <div className="bg-grid-pattern absolute inset-0 opacity-5" />
          <div className="bg-primary/5 absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
          <div className="bg-secondary/5 absolute top-1/4 right-1/4 h-64 w-64 rounded-full blur-2xl" />
        </>
      )}

      <div className={cn("relative container", "p-0 md:p-[1rem]")}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div
            className={cn(
              "flex flex-col gap-4",
              theme === "classic" && "text-center",
            )}
          >
            <h2 className={cn(titleVariants({ size, theme }))}>
              {title || "Pricing"}
            </h2>
          </div>

          <div
            className={cn(
              "flex flex-col justify-between gap-5 md:gap-10",
              theme === "classic"
                ? "md:flex-col md:items-center"
                : "md:flex-row",
            )}
          >
            <p className={cn(descriptionVariants({ size, theme }))}>
              {description ||
                "Transparent pricing with no hidden fees. Upgrade or downgrade anytime."}
            </p>

          </div>

          <div className="flex w-full flex-col items-stretch gap-6 md:flex-row md:items-stretch">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={cn(
                  cardVariants({
                    size,
                    theme,
                    highlight: plan.highlight,
                  }),
                )}
              >
                {/* Classic theme highlight effect */}
                {theme === "classic" && plan.highlight && (
                  <>
                    <div className="via-primary absolute -top-px left-1/2 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent" />
                    <div className="absolute top-4 right-4">
                      <Badge className={highlightBadgeVariants({ theme })}>
                        Most Popular
                      </Badge>
                    </div>
                  </>
                )}

                <Badge
                  className={cn(
                    theme === "classic" && !plan.highlight
                      ? "bg-muted text-muted-foreground border-border/50 mb-8"
                      : highlightBadgeVariants({ theme }),
                  )}
                >
                  {plan.title}
                </Badge>

                  <div>
                    <span className={cn(priceTextVariants({ size, theme }))}>
                      {parseFloat(plan.monthlyPrice) > 0 && (
                        <>{plan.currency}</>
                      )}
                      {plan.monthlyPrice === "0" ? "Free" : plan.monthlyPrice}
                    </span>
                  </div>

                <Separator
                  className={cn(
                    "my-6",
                    theme === "classic" &&
                      "via-border bg-gradient-to-r from-transparent to-transparent",
                  )}
                />

                <div className="flex h-full flex-col justify-between gap-10">
                  <ul className="text-muted-foreground space-y-4">
                    {plan.features.map((feature, featureIndex) => (
                      <motion.li
                        key={featureIndex}
                        className="flex gap-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: featureIndex * 0.05,
                        }}
                      >
                        <HugeiconsIcon
                          icon={Tick01Icon}
                          className={cn(featureIconVariants({ size, theme }))}
                        />
                        <span
                          className={cn(
                            theme === "classic" && "text-foreground/90",
                          )}
                        >
                          {feature.name}
                        </span>
                      </motion.li>
                    ))}
                  </ul>

                  <Button
                    className={buttonVariants({ theme })}
                    onClick={() => onPlanSelect?.(plan.id)}
                    aria-label={`Select ${plan.title} plan`}
                  >
                    {theme === "classic" && plan.highlight && (
                      <HugeiconsIcon icon={FlashIcon} className="mr-1 h-4 w-4" />
                    )}
                    {plan.buttonText}
                    {theme === "classic" && (
                      <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-white/0 via-white/10 to-white/0 transition-transform duration-700 hover:translate-x-[100%]" />
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

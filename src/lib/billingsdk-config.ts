export interface Plan {
  id: string;
  title: string;
  description: string;
  highlight?: boolean;
  type?: "monthly" | "yearly";
  currency?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  buttonText: string;
  badge?: string;
  features: {
    name: string;
    icon: string;
    iconColor?: string;
  }[];
}

export interface CurrentPlan {
  plan: Plan;
  type: "monthly" | "yearly" | "custom";
  price?: string;
  nextBillingDate: string;
  paymentMethod: string;
  status: "active" | "inactive" | "past_due" | "cancelled";
}

export const plans: Plan[] = [
  {
    id: "free",
    title: "Free",
    description: "Basic multi-stream viewing experience.",
    currency: "$",
    monthlyPrice: "0",
    yearlyPrice: "0",
    buttonText: "Current Plan",
    features: [
      { name: "Watch up to 8 Streams", icon: "check" },
      { name: "1 Saved Custom Layout", icon: "check" },
      { name: "Public Roster Access", icon: "check" },
    ],
  },
  {
    id: "pro",
    title: "Lifetime Pro",
    description: "Unlock the ultimate squad viewing experience forever.",
    currency: "$",
    monthlyPrice: "29.99",
    yearlyPrice: "29.99",
    buttonText: "Upgrade Now",
    badge: "One-time payment",
    highlight: true,
    features: [
      { name: "Unlimited Saved Layouts", icon: "check" },
      { name: "Ad-free Experience", icon: "check" },
      { name: "Custom Profile Themes", icon: "check" },
      { name: "Exclusive Pro Badge", icon: "check" },
    ],
  }
];

---
preset: b1VlJDbW
palette: neutral
base-radius: 0.625rem
icons: Hugeicons
---

# StreamHuddle Design System

StreamHuddle uses the `b1VlJDbW` shadcn preset as its foundation. Keep new interface work consistent with the tokens and shared components below.

## Visual language

- Use Geist Variable for interface text. The app loads it from `@fontsource-variable/geist` and exposes it as `font-sans` in `src/styles.css`.
- Use the neutral OKLCH tokens from `src/styles.css` for backgrounds, text, cards, borders, focus rings, and destructive states. Components should use semantic classes such as `bg-background`, `text-foreground`, `bg-card`, `border-border`, and `ring-ring` instead of hard-coded colors.
- The default radius is `0.625rem`. Tailwind radius tokens are derived from it: `sm` 0.6×, `md` 0.8×, `lg` 1×, `xl` 1.4×, `2xl` 1.8×, `3xl` 2.2×, and `4xl` 2.6×.
- Theme colors are CSS variables. Keep theme-aware components on semantic color tokens so light, dark, and custom themes continue to work.

## Components and icons

- Prefer the shared primitives in `src/components/ui/` for buttons, fields, menus, dialogs, cards, and feedback. Extend a shared primitive when the same interaction is needed in more than one place.
- Use Hugeicons from `@hugeicons/core-free-icons` with `HugeiconsIcon` from `@hugeicons/react`. Give icon-only controls an accessible name.
- Use existing page containers and layout components before adding new page chrome. Keep stream viewing controls compact so the video grid remains the focus.

## Interaction and accessibility

- Use native buttons, links, labels, and form controls. Provide visible keyboard focus, accessible names, and useful loading, empty, error, and success states.
- Preserve the reduced-motion behavior in `src/styles.css`. Motion should clarify a state change and must respect `prefers-reduced-motion`.
- For responsive pages, keep primary actions reachable on narrow screens and avoid forcing horizontal scrolling outside the multi-stream player surface.

## Validation

After design-affecting changes, run:

```sh
npx @google/design.md lint DESIGN.md
```

Then check the affected route at desktop and mobile widths and run `bun run typecheck` and `bun run build`.

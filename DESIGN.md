---
name: PJP Hardware
description: A forest-green and warm-ivory workspace for clear daily operations.
colors:
  primary: "#216c4d"
  primary-hover: "#164f38"
  workspace: "#f2f5ed"
  surface: "#fcfdf8"
  canvas: "#e7ede2"
  forest-start: "#204b37"
  forest-end: "#102f25"
  mint-active: "#b1edb2"
  text-primary: "#20382a"
  text-secondary: "#5b6b5d"
  border: "#dfe7d9"
  success: "#246747"
  success-bg: "#e2f3e3"
  success-border: "#c4e5ca"
  warning: "#8b5b0b"
  warning-bg: "#fff2d3"
  danger: "#ac3e43"
  danger-bg: "#fce9e7"
  danger-border: "#eec9c6"
  info: "#2d6660"
  info-bg: "#e8f1ea"
  form-bg: "#fbfcf7"
  form-border: "#d9e2d3"
  table-header: "#f0f5e9"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "clamp(21px, 1.9vw, 27px)"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  metric:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "clamp(21px, 1.8vw, 27px)"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
  action:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  badge: "5px"
  sm: "8px"
  navigation: "9px"
  md: "12px"
  lg: "16px"
  sidebar: "18px"
  workspace: "20px"
  login: "22px"
spacing:
  icon-gap: "8px"
  compact-gap: "10px"
  control-gap: "12px"
  card-gap: "15px"
  panel-gap: "20px"
  section-gap: "22px"
  panel-padding: "22px"
components:
  button-primary:
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "#f6f9ef"
    textColor: "#36573f"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "#a63c42"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.form-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 13px"
    width: "100%"
  navigation:
    textColor: "#c9d9ca"
    rounded: "{rounded.navigation}"
    padding: "13px 14px"
    width: "100%"
  badge-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  badge-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  badge-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  badge-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "22px"
  metric-card:
    rounded: "{rounded.lg}"
    padding: "21px"
  action-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  table-header:
    backgroundColor: "{colors.table-header}"
    textColor: "#586c5a"
    padding: "12px 13px"
---

# Design System: PJP Hardware

## Overview

**Creative North Star: "Clear daily operations"**

The implemented world places a quiet, warm workspace beside a dark forest-green navigation rail. Compact Manrope typography, pale sage surfaces, mint details, and clearly divided records make daily stock, sales, and reservation work easy to scan. This wording comes from the implemented direction contract; it is not an additional brand interview.

The user-selected reference establishes the palette and operational character across login, dashboard, inventory, sales, reservations, analytics, and user settings. The existing PJP HARDWARE name and logo remain the brand anchors. Hardware imagery supports the login and welcome banner; records, controls, and charts carry the working screens. Desktop counter use and mobile access remain design assumptions recorded in PRODUCT.md, rather than confirmed device research.

**Key Characteristics:**

- Dark forest navigation with a brighter selected row and a mint location dot.
- Warm ivory and sage surfaces separated by fine borders and restrained tonal changes.
- Compact Manrope headings, descriptive labels, and tabular operational values.
- Responsive records that retain their labels and actions when tables become stacked rows.
- Functional state feedback, visible keyboard focus, and reduced-motion support.

The normative primitives above are extracted from `frontend/src/index.css`; component behavior comes from `frontend/src/components` and the working views. Typography role names and spacing names organize observed values rather than introducing a new scale. The sidecar contains gradients, interaction states, responsive metadata, and self-contained component previews. Its generated tonal ramps are display metadata, not new application color tokens.

## Colors

Forest green anchors navigation and actions; pale, slightly yellow-green neutrals keep the workspace warm and calm.

### Primary

- **Working Green** (`primary`): text links, action emphasis, numeric totals, and the base green family. Primary filled controls use the existing green gradient documented in the sidecar; hover resolves to `primary-hover`.
- **Forest Gradient** (`forest-start`, `forest-end`): the navigation shell, providing a persistent dark edge beside the light workspace.
- **Mint Location** (`mint-active`): the small selected-page indicator. The selected navigation row is a brighter green gradient, with white icon and text.

### Secondary

- **Success Green** (`success`, `success-bg`, `success-border`): confirmed or available states and positive reservation actions.
- **Amber Attention** (`warning`, `warning-bg`): low stock and pending states, with a visible text label.
- **Muted Red** (`danger`, `danger-bg`, `danger-border`): unavailable stock, destructive affordances, and errors. Destructive filled buttons use their distinct component color above.
- **Quiet Teal** (`info`, `info-bg`): informational badges such as units and selected role/status categories.

### Neutral

- **Sage Canvas** (`canvas`) surrounds the inset desktop shell.
- **Warm Workspace** (`workspace`) fills the main working area.
- **Ivory Surface** (`surface`) fills panels and tables; inputs use the closely related `form-bg` and `form-border` pair.
- **Forest Ink** (`text-primary`) carries headings, names, and key values; **Muted Leaf Ink** (`text-secondary`) carries descriptions and supporting labels.
- **Fine Sage Border** (`border`) separates panels without a heavy outline. The table header has its own softly tinted `table-header` background.

**The Labeled State Rule.** Keep a readable text label with stock, reservation, and role badges; color alone must not carry the record's meaning.

## Typography

**Display Font:** Manrope, with Segoe UI and sans-serif fallbacks.
**Body Font:** The same Manrope stack; there is no separate display or monospace family.

Manrope is self-hosted as a variable font with weights from 200 to 800. The interface uses tight, weighted headings and calmer supporting copy. The hierarchy is compact and role-based rather than a single mathematical type scale.

- **Display:** The larger login statement uses the `display` role and steps down at tablet and phone widths.
- **Headline:** Page titles use `headline` on desktop, then step to 21px, 19px, and 17px at the implemented compact breakpoints.
- **Metric:** Summary values use `metric` with tabular numerals and wrapping for long values. Their narrow-phone sizes step down to 21px and then 19px.
- **Title:** Standard section headings use `title`; chart and stock-panel headings use a compact 14px variant.
- **Body:** The base role is 14px. Most operational cells and fields are 12px; descriptions and supporting metadata range from 9px to 12px according to their existing context.
- **Label and action:** Form labels use `label`; standard action text uses `action`. Status badges are compact 9px, weight 700, with a 1.6 line height.

**The Numeric Alignment Rule.** Preserve tabular numerals for metrics and operational tables so changing amounts and quantities remain easy to compare.

## Layout

The desktop application sits in a small inset shell. The navigation rail is fixed, 216px wide, with a 14px outer inset. Main content starts after the rail and has 28px top, 30px horizontal, and 32px bottom padding. Its rounded workspace surface continues to at least the viewport height. At widths above 1600px, workspace padding expands and charts gain height.

View sections form a vertical stack. Metrics use an auto-fitting grid, followed by chart, stock, or table panels appropriate to the page. The dashboard's wide two-column area gives revenue more width than stock alerts. Forms begin inside native disclosure panels; closed panels keep the record area available for scanning.

The implemented width breakpoints are 1250px, 1050px, 768px, 576px, and 360px, with a larger-screen rule at 1600px. At 1250px the rail reduces to 188px. Between 769px and 1050px, metrics become two columns and split content panels stack. At 768px and below, the rail becomes a 250px drawer, the shell loses its outer inset, and the header reduces account detail.

At 576px and below, desktop tables become vertically stacked records. Every cell supplies a `data-label`, values wrap, and actions retain their own labeled area. Forms stack, inputs increase to 16px text and at least 46px height, and quick actions fill the available width. Small-screen metrics remain two columns. Login switches from a two-column composition to a compact brand header followed by the form. At 360px and below, padding and headline size reduce again. The base document supports widths from 320px.

The main rhythm uses small icon/control gaps, medium panel gaps, and consistent panel padding as represented in the frontmatter. Keep per-page inline layout exceptions when they serve an existing form or record; the extracted spacing names are documentation aliases, not new CSS variables.

## Elevation & Depth

Tonal layering and thin sage borders create most depth. Working panels have no default box shadow. Gradients are restrained and localized to the navigation shell, selected navigation, primary actions, metric surfaces, and login background. Stronger shadows belong to overlapping or framing surfaces.

### Shadow Vocabulary

- **Selected navigation** (`0 5px 12px #071e241a`): a restrained shadow under the selected row.
- **Product options** (`0 10px 25px #203a2426`): separates the product suggestion list from the form beneath it.
- **Modal** (`0 24px 80px #071a2459`): separates a dialog from its darkened overlay.
- **Login frame** (`0 24px 80px #2b4c3620`): a diffuse shadow around the full login card.

The root stylesheet also declares an unused generic shadow; it is intentionally not promoted as a panel treatment here. The shared modal overlay darkens the page; no blur treatment is part of the current world.

**The Surface Separation Rule.** Use the established surface tones and borders for working panels; retain stronger shadows for the implemented overlapping and framing surfaces.

## Shapes

Controls use gently curved corners, while panels and the outer shell use broader corners. The frontmatter records the recurring radius scale: compact badges, fields and buttons, navigation rows, metric icon wells, panels, sidebar, workspace, and login frame. Badges are compact rounded rectangles rather than pills. Avatars, logo holders, chart legend marks, and the active navigation dot use circles.

Panel and field borders are thin. Table header corners soften the first and last cell; row separators remain straight and quiet. Mobile screens reduce the outer shell curvature, while the drawer keeps rounded trailing corners. The welcome illustration uses a cropped curved edge; it is a signature image treatment rather than a requirement for every panel.

## Components

### Buttons

Filled primary buttons use the existing forest-green gradient and white text. Secondary buttons use pale sage with a fine border and green text; success actions use the semantic success pair. Filled destructive confirmation buttons use muted red. Text links, icon buttons, and red outline/delete affordances remain lower-emphasis variants in the application.

Standard controls have 8px corners and at least 42px height, increasing to 44px on mobile. Small buttons begin at 36px and reach 40px on mobile; table row actions receive at least 44px square touch areas there. Disabled buttons fade to half opacity and use the disabled cursor. Hover changes color or border without a decorative lift. Keyboard focus uses the shared visible outline.

### Chips

Stock, unit, reservation, and role badges use a compact rounded rectangle with a semantic pale background and darker text. They communicate state rather than acting as filters. Keep the corresponding word or quantity visible and retain the existing role/status mapping in each view.

### Cards / Containers

Working panels use ivory fill, a fine sage border, and broad corners. Metric cards add a faint ivory-to-sage gradient, with a label, bold value, short explanatory line, and a green icon well. The metric component has green, amber, and red icon treatments; its loading state shows a spinner in place of the value. Panel spacing reduces at smaller breakpoints without collapsing the hierarchy.

### Inputs / Fields

Fields use pale ivory fill, a fine sage outline, a visible label, and gently curved corners. Hover darkens the border. Focus changes the border to a stronger green, adds a pale green outline, and lightens the field background. Error feedback appears in the existing alert pattern rather than an invented field-error style.

The product picker adds a search icon, an optional clear button, and an elevated options list. Options expose availability text; unavailable products are disabled. Arrow keys, Enter, Escape, focus management, and the combobox/listbox relationship are part of this component's implemented behavior.

### Navigation

The forest rail centers the preserved logo and brand name above compact icon-and-label rows. Active navigation has a brighter green gradient, white text, and a mint dot. Hover has a muted green fill. Page access and user settings follow the application's existing role restrictions.

On mobile, the navigation becomes a dismissible drawer over a dark overlay. Opening it locks background scrolling, moves keyboard focus inside, and traps Tab navigation; Escape closes it and focus returns to the invoking control. Preserve these behaviors when adapting the shell.

### Operational Tables

Tables use quiet tinted headers, fine row dividers, left-aligned labels, tabular values, and a pale green row hover. Specific column widths support each record type. Action groups wrap; long names and references wrap rather than widening the document. On narrow phones, cell labels and values form a two-column record structure beneath a visually hidden table header.

### Disclosure Forms and Dialogs

Native disclosure panels place a short form title and description beside a green action-shaped toggle. Opening adds a divider and reveals the form; the chevron rotates. The toggle's repeated text hides on narrow phones while the panel title remains.

Shared dialogs center an ivory surface over a forest overlay. They lock background scrolling, move focus inside, trap Tab, and return focus on close. Escape and backdrop dismissal invoke the available close control; busy states can disable it. Confirmation actions are explicit, with destructive actions visually red.

### Charts and Supporting Imagery

Revenue charts use a green line and translucent green area, restrained grids, and a dark tooltip. Analytics category colors belong to the existing chart palette; preserve their matching legend labels. Keep chart values tied to records and show the implemented empty, loading, or error state when data is unavailable. The existing logo and generated hardware illustration remain the shipped identity assets; image provenance belongs with those assets and must be preserved.

Motion is functional: color/border transitions use 0.18s, disclosure chevrons use 0.2s, and the mobile drawer uses 0.24s ease. The loading spinner uses a 0.9s linear loop. Reduced-motion rules suppress transitions and repeated animation.

## Do's and Don'ts

### Do:

- **Do** preserve the PJP HARDWARE name and existing logo across the working shell and login.
- **Do** use forest navigation, warm ivory/sage surfaces, and the established green action hierarchy consistently across screens.
- **Do** retain text labels with semantic status colors and visible focus on interactive controls.
- **Do** preserve tabular values, wrapping record content, mobile cell labels, and reachable actions.
- **Do** keep empty, loading, error, and unavailable states honest and tied to the underlying records.
- **Do** preserve the existing drawer, dialog, product-picker, and reduced-motion behavior when extending components.

### Don't:

- **Don't** replace the confirmed palette, Manrope family, or preserved brand assets as an incidental screen change.
- **Don't** use color alone to distinguish stock, reservation, or role states.
- **Don't** let long names, receipt references, or action groups force the page wider on phones.
- **Don't** add unsupported growth claims, fabricated operational values, or success feedback without the corresponding result.
- **Don't** treat the sidecar's generated tonal ramps as additional application colors or as user-approved palette choices.

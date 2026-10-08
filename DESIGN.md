---
name: Finance / personal
description: A light, practical local financial ledger.
colors:
  primary: "#245c47"
  primary-hover: "#174735"
  paper: "#f5f5ef"
  surface: "#ffffff"
  ink: "#202e29"
  muted: "#5e6b64"
  line: "#d6ddd5"
  tint: "#e7eee6"
  navigation: "#ebeee6"
  navigation-active: "#d8e3d7"
  focus: "#a36022"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "58px"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  field: "6px"
  button: "7px"
  surface: "12px"
spacing:
  compact: "8px"
  control: "16px"
  field-gap: "18px"
  group: "24px"
  panel: "26px"
  column: "30px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    padding: "10px 16px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "26px"
---

# Design System: Finance / personal

## Overview

**Creative North Star: "The Practical Ledger"**

The confirmed direction is light and practical: a quiet off-white workspace, pale sage navigation and dark green actions. Generous reading space supports financial review. System fonts are an intentional choice for this offline local task UI. No decorative imagery, external fonts or network assets are used.

**Key Characteristics:**
- Familiar labelled controls and readable figures.
- Flat bordered panels and restrained tonal grouping.
- Inspectable comparisons with explicit financial caveats.

This records the built visual system from `src/app/dashboard.tsx` and `src/app/globals.css`. The independent review's bounded disposition is ship for Overview and scenario surfaces; the chart correction is resolved. This document does not assert review or functional validation of the other tabs. Existing captures are under `.impeccable/review/`.

## Colors

### Primary

Deep Ledger Green marks primary actions; its darker hover variant provides state feedback. Soft Sage Tint groups the housing decision and success feedback. Ochre marks keyboard focus and the chart's zero guide.

### Neutral

Warm Paper forms the workspace, White Surface holds panels, and Sage Navigation separates the app's navigation. Dark Green Ink supports primary reading; Muted Green Grey supports dates, hints and secondary text. Pale Green Grey lines separate panels and ledger rows. Active navigation uses a stronger sage fill.

## Typography

**Display Font:** Arial, Helvetica, sans-serif.
**Body Font:** Arial, Helvetica, sans-serif.

The shared system sans stack keeps headings and controls familiar. Access-screen display text reduces to 44px on mobile; page headlines reduce to 29px. Summary figures use 34px on desktop, 27px at the intermediate breakpoint and 32px on mobile. Supporting details use 12px. Amounts use tabular numerals.

**The Figure Alignment Rule.** Keep financial amounts tabular and retain visible units and explanatory labels.

## Layout

The desktop shell uses a 230px navigation column and fluid workspace capped at 1500px. Main padding is 38px by 44px. Overview summaries use three columns; account and recurrence panels use two. Forms use three columns with 18px gaps.

At 1050px, navigation becomes 190px, panel columns stack and forms become two columns. At 650px, navigation becomes a horizontal scrolling row, summaries and forms stack, headers wrap, and main padding becomes 24px by 18px. Ledger tables scroll horizontally. Panels use 26px padding, reduced to 20px on mobile.

## Elevation & Depth

No shadows or gradients are used. Borders and quiet differences between paper, navigation, white panels and sage callouts convey grouping.

## Shapes

Containers have softly rounded corners; controls use smaller radii from the frontmatter. One-pixel strokes define panels, fields and row divisions. Buttons remain compact rectangles with comfortable padding.

## Components

### Buttons

Primary actions use green with white text and a darker hover fill. Secondary actions use transparent backgrounds, green text and pale borders. Disabled buttons reduce opacity to 0.55 and show a wait cursor. Keyboard focus uses a 3px ochre outline with 3px offset.

### Inputs / Fields

Native inputs, selects and textareas use white fill, a muted green grey border, visible labels and the shared focus treatment. Errors appear in a pale coral message with dark red text; notices use sage fill. Busy and notice text uses a polite live region; errors use an alert role.

### Cards / Containers

White bordered panels use the surface radius and panel padding. The summary stays on the paper background with a lower divider. Account and recurring rows pair descriptions with tabular amounts and freshness or estimate details.

### Navigation

Five named views use muted text and transparent backgrounds. The active item adds sage fill and bold dark green text. Mobile keeps each label on one line in a scrolling row. Session locking stays available below navigation.

### Cash-flow comparison

The chart compares daily closing balances on a shared scale including zero. A solid green scenario line and dashed grey current-plan line retain non-scaling strokes. The ochre dashed horizontal guide marks zero. Currency scale labels and endpoint dates sit outside the SVG so they remain readable as chart width changes; the plot stays 240px tall. A caption identifies the lines and distinguishes daily closing balances from within-day minimums. An accessible image description reports key results; expandable JSON exposes the calculation evidence.

## Do's and Don'ts

### Do:
- **Do** retain the light, practical palette and system font stack.
- **Do** label financial figures, balance freshness, recurring estimates and fictional demo data explicitly.
- **Do** keep chart labels outside the stretching SVG and provide inspectable evidence.

### Don't:
- **Don't** add decorative imagery, external fonts or network assets to this local visual system.
- **Don't** replace borders and tonal grouping with decorative shadows or gradients.
- **Don't** present nominal plan headroom or recurring candidates as confirmed cash forecasts or bills.

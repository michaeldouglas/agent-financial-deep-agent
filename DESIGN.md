# Design system

## Surface

Financial Deep Agent is an **Operate** interface. The chat is the work surface; its visual identity should make exploration feel focused, capable, and alive while keeping financial answers easy to read.

## Visual direction

An evening analysis room: a dark evergreen canvas with luminous mineral green and clear aqua signals. The user is reading and composing financial questions in a browser, often with several answers open, and needs a calm, high-contrast screen that holds attention without looking like a trading terminal. Commit the page to deep color, then use contrasting panels and a small number of bright accents to give it depth. The signature is a drawn signal path that connects a question, analysis, and an understandable answer. It is an illustration of the product's interaction, never a claim about live data.

## Color tokens

- **Night ink:** `#08191D` — page ground.
- **Deep panel:** `#10272C` — header, composer, and answer surfaces.
- **Raised panel:** `#17353A` — prompts and interactive surfaces.
- **Text:** `#F0F5EE` — primary text on dark surfaces.
- **Muted text:** `#B4C7C2` — secondary text; keep normal text at 4.5:1 or higher.
- **Citrus:** `#C7F36A` — main action and active state.
- **Aqua:** `#79DED0` — signal path and selected highlights.
- **Violet:** `#B8A8FF` — one secondary illustration accent.
- **Border:** `#315056` — quiet structural separation.
- **Critical:** `#FF9A8D` — errors only.

Use citrus and aqua with restraint; keep the main ground dark and use full tinted surfaces for emphasis. Do not use gradients for text, fake prices, market signals, or decorative charts.

## Type and layout

Use Sora for display headings and IBM Plex Sans for interface and reading. Use tabular numerals for values. Keep a centered, readable conversation width on desktop; use a two-part welcome composition with a strong heading, the signal illustration, prompt examples, and a fixed composer. On phones, keep the illustration compact and let suggestions and conversation remain the primary controls. Preserve the existing chart and document surfaces, including their independent output contracts.

## Motion

The welcome state has one authored GSAP sequence: a clipped heading reveal, a drawn signal path, and staggered prompt cards. ScrollTrigger reveals prompt pages when they enter view. A slow signal pulse gives the illustration life; hover, focus, and send states respond immediately. Never animate financial values or suggest hidden work. Skip all decorative motion when `prefers-reduced-motion` is enabled.

## Voice

Write in concise Brazilian Portuguese. Name the user's next action directly. Keep error messages specific, preserve drafts on failure, and distinguish sourced data from fictional examples without implying personalized advice.

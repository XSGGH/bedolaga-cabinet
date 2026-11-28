# Winter event public announcement

- The public `/snow-event` page **before the official start** is deliberately a simple, spoiler-free teaser in `src/components/snow-event/SnowEventTeaser.tsx` and `snow-teaser.css`.
- **Never change that pre-launch teaser in future game, reward, economy, station, illustration or admin-preview tasks** unless the user explicitly asks to modify the announcement itself.
- Keep the public announcement free of tabs, maps, gameplay, reward details, currencies, progress, paid subscription prompts and admin tools. It should show only the event name, a discreet winter atmosphere, the Moscow start time and a server-anchored countdown.
- Keep admin sandbox/test previews and post-start event features functional and separate. At the official start, the live phase must automatically render the full event without requiring another deployment.

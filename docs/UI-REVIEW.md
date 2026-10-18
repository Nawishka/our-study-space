# Studio themes and audio update

Implemented on 18 October 2026. The owner approved publication after requesting a warmer light theme and sound verification. The existing GitHub Pages workflow verifies and publishes pushes to `main`; its successful deployment is the release confirmation.

## Review it

With the preview server running, open **http://127.0.0.1:4173/?demo=1#/journey**. Use the clearly labelled demo role selector to inspect Melan, Shashi and Host. Light, Dark and System are available on the login screen and throughout the app. Preferences stay on this device. Demo data remains separate from production and cannot save real tests, plans or points.

If the server has stopped, run `npm run build`, then `npm run preview -- --port 4173`. The normal sign-in screen is at **http://127.0.0.1:4173/** without the demo parameter. Existing username/password authentication is unchanged.

## What changed

- Notification heading, bell, badge, filters and list share one responsive card inset. Red warnings remain explicit in both themes.
- Warm cream work surfaces on an oatmeal canvas, restrained inset/raised controls, glass theme controls and mobile navigation, clearer typography and hierarchy. Sage and lavender retain their student meanings. Dark colours remain deliberately tuned independently.
- Complete light/dark colour tokens, including forms, charts/tooltips, notifications, Host controls, reward panels and empty states. An early script resolves the stored/system theme before React and styles load. System changes and preferences from other tabs update correctly; blocked device storage falls back safely.
- Brief press, icon, details and progress feedback; all motion honours device reduced motion and the independent animation preference. Existing backend-confirmed feedback gates remain unchanged. No success effects were added to optimistic task state.
- Sound remains off by default. Enable **Sounds on**, then select **Test sound** for an explicit short sample, including in demo mode. Playback waits for the browser audio context to resume and reports unavailable audio honestly. Turning sounds off cancels playback; remembered preferences never autoplay. The sample does not pretend a study operation succeeded or consume a success receipt.
- Original lightweight shaded SVG companions, with unique gradient IDs for repeated reward/scene instances. Existing score positions, reward interaction, numerical labels and reduced-motion behavior remain intact.
- Stable, determined copy focused on effort, without shaming or sacrificing rest.

## Screenshots

- [Light desktop](../artifacts/ui-review/light-journey-desktop.png)
- [Dark desktop](../artifacts/ui-review/dark-journey-desktop.png)
- [Light mobile notifications](../artifacts/ui-review/light-notifications-phone.png)
- [Dark mobile notifications](../artifacts/ui-review/dark-notifications-phone.png)
- [Light companions](../artifacts/ui-review/light-companions.png)
- [Dark companions](../artifacts/ui-review/dark-companions.png)

## Verification

- TypeScript, ESLint and production build passed.
- **69 Vitest cases passed** in a complete run, plus **9 Node tests**. Existing database/security, tasks, test submission/approval, scoring, notifications, Host points, reward/reset, failed-save and duplicate-feedback regressions are retained. New theme checks cover persistence, system changes, cross-tab synchronization, unavailable storage, early initialization and independent sound/motion preferences. Audio tests include delayed/rejected resume, explicit sample playback, cancellation when disabled and unavailable audio.
- **30 Playwright checks passed** against the built local preview in Edge. They cover both themes on every page with all three demo roles at **375, 768 and 1440 pixels**, including open notification panels, warning contrast, Host point/settings forms, student submission forms, overflow and axe WCAG A/AA checks. Keyboard selection, theme persistence, system changes, reduced motion and theme-control touch areas are covered.
- The browser audio test observes the **real Web Audio graph**: no context before interaction, no notes simply from enabling sound, nonzero bounded sample output after Test sound, a return to silence, and no autoplay after reload. This measures browser-generated audio, not a physical speaker or the phone's volume/mute settings.

These are **local, demo and mocked/embedded-database checks**. They do not verify signed-in hosted Supabase workflows or physical iPhone behavior. No Supabase configuration, migration, account, password, permission, study record, proof, scoring rule, notification or reward is changed by this release. The earlier notifications migration has its own setup status; this theme/audio release does not apply database migrations.

## Sound troubleshooting

Choose **Sounds on → Test sound** after signing in (or in the clearly labelled demo). If the sample reports playback but is inaudible, check device volume, tab/site mute settings and the selected output device. Reload and tap Test sound again if a mobile browser suspended audio. Reduced motion is independent of sound. Demo task edits deliberately do not play backend-success sounds; real task, plan and submission feedback waits for a confirmed save, and submissions still await Host approval.

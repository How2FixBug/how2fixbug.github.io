# Editing quests.json

The site loads quests from `quests.json`. Edit this file to change quest text, requirements, rewards, shop items, and achievements.

## Quest fields
- `id`: unique identifier; don't reuse an ID for a different quest.
- `title`, `description`: text shown on the Rewards page.
- `type`: one of `visit_page`, `visit_pages`, `time_on_site`, `click_link`, or `lifetime_earned`.
- `page`: page name for `visit_page` and `click_link` (`home`, `about`, or `rewards`).
- `pages`: list of page names for `visit_pages`.
- `target`: required count, seconds, or lifetime BB earned.
- `reward`: BugBucks paid when the visitor claims the completed quest.
- `frequency`: `daily` resets each local calendar day; `once` can be claimed once in that browser.

## Shop fields
Each item needs a unique `id`, `name`, `description`, and `price` in BB.

## Achievement fields
Each achievement needs a unique `id`, `name`, `description`, and `totalEarned` threshold.

## Available quest types
- `visit_page`: visit one page.
- `visit_pages`: visit every page in the `pages` list.
- `time_on_site`: spend the specified number of active seconds on the site. Background tabs don't count.
- `click_link`: click a link that navigates to the specified page.
- `lifetime_earned`: reach a lifetime earned-BB total.

BugBucks are browser-local demo points, not real money. Visitors can modify browser storage, and balances do not sync across devices or users. A trusted backend is needed for a secure global economy or leaderboard.

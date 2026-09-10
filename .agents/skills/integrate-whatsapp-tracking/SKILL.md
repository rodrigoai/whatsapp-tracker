---
name: integrate-whatsapp-tracking
description: Integrate production-compatible WhatsApp Tracking into websites and web applications. Use when Codex needs to add the tracker scripts, connect buttons and links to the hosted lead form, track submissions from existing forms, assign lead subjects, call the public JavaScript API, or verify an integration without breaking its current production behavior.
---

# Integrate WhatsApp Tracking

Connect a target website to the hosted WhatsApp Tracking widget while preserving existing markup, framework conventions, analytics, and default production behavior.

## Workflow

1. Read the target repository instructions and inspect its framework, script-loading convention, tests, and existing tracker integration.
2. Find an existing `/api/script.js?accountId=...` or `/api/forms/script.js?accountId=...` tag before adding another one. Reuse its host and account ID. Never invent either value; ask the user when they cannot be discovered.
3. Identify whether the request concerns hosted-form triggers, existing-form submissions, or both. Use the contract for that integration mode.
4. Make the smallest additive change. Do not recreate the modal, submit directly to `/api/conversion`, add a separate click handler, or implement attendant routing in the target project.
5. Verify behavior proportionately using the project test suite or a local browser. Confirm that opted-in controls open the form and their original action does not also run.
6. Report the edited files, integration mode, subjects used, and any configuration the user must supply.

## Integration Contract

### Preserve the default script

Use the existing production format when the floating button should remain:

```html
<script src="https://watracker.coyo.com.br/api/script.js?accountId=ACCOUNT_ID"></script>
```

Omitting widget options must preserve the injected floating button. Keep only one tracker script per page unless the user explicitly describes a supported multi-account design.

### Connect existing elements

Add `data-wa-tracking` to an existing button or link. Add `data-wa-subject` only when that trigger needs a subject:

```html
<button type="button" data-wa-tracking data-wa-subject="Enterprise plan">
  Talk to sales
</button>
```

```html
<a href="/contact" data-wa-tracking data-wa-subject="Technical support">
  Get support
</a>
```

The tracker uses delegated click handling, so the same attributes work for elements rendered after the script loads. Do not generate IDs or maintain selector arrays.

The opted-in click is prevented while the form opens. Check for conflicting application handlers, form submission, or navigation. Prefer `type="button"` when a trigger sits inside a form and is not intended to submit it.

### Register subjects

Treat the subject as short lead context, such as a product, plan, department, or CTA origin. Keep it stable, human-readable, non-sensitive, and at most 160 characters. Different triggers may use different subjects. Omit the attribute rather than sending an empty placeholder when no subject is needed.

The hosted tracker submits and stores the subject, shows it in the Leads screen, and includes it in supported analytics payloads. Do not overload the account-wide conversion name with a per-button subject.

### Track an existing form

Existing page forms use the separate forms tracker and a configured CSS selector. When an existing form has no stable selector, make the only markup change a unique `id`:

```html
<form id="lead-form">
  <!-- Preserve the existing fields and submission behavior. -->
</form>
```

Register the form in the tracker's **Forms** screen with a human-readable name and the matching selector, such as `#lead-form`, and keep that form tracking entry active. Then load the forms script once:

```html
<script src="https://watracker.coyo.com.br/api/forms/script.js?accountId=ACCOUNT_ID"></script>
```

Re-use a suitable existing unique ID instead of replacing it. Do not add submit handlers, tracking attributes, hidden fields, or changes to the form action. The forms tracker listens for submission without preventing or replacing the form's existing behavior and also binds matching forms rendered after the script loads.

The supported lead fields are `name`, `email`, and `phone`. The tracker discovers them from existing field semantics, including `name`, `id`, `type`, `autocomplete`, placeholder, accessible label, and associated `<label>` text. Make sure at least one of the three fields is recognizable and non-empty:

- Name is supported but is not required when email or phone is available.
- Email is optional.
- Phone is optional.

Do not implement validation or deduplication in the target site as part of this integration. Do not rename or alter fields merely to improve detection unless the user explicitly requests it; instead, report when none of the supported fields can be recognized.

### Disable only the floating button

When the user wants only page-owned triggers or programmatic opening, add the exact script attribute:

```html
<script
  src="https://watracker.coyo.com.br/api/script.js?accountId=ACCOUNT_ID"
  data-wa-floating-button="false"
></script>
```

Do not add this option unless the user wants the injected floating button removed. Its absence is the backward-compatible default.

### Open programmatically

Use the public API when a framework component or application event cannot be expressed cleanly with HTML attributes:

```js
window.WhatsAppTracking.open({ subject: "Enterprise plan" });
```

The subject is optional:

```js
window.WhatsAppTracking.open();
```

Call the API only after the tracker script has loaded. Follow the target framework's supported script loader and load callback rather than polling. In TypeScript projects, add the narrowest local `Window` declaration required by the project instead of using broad `any` types.

## Guardrails

- Preserve an existing production script tag unless the requested behavior requires an additive attribute.
- Preserve control text, styling, accessibility names, keyboard behavior, and framework event conventions.
- Do not put personal data, user input, HTML, credentials, or secrets in `data-wa-subject`.
- Do not change allowed origins from the client project. If conversion requests are rejected, tell the user that the page origin must be added in the tracker account configuration.
- Do not assume that an older deployed tracker supports these features. If behavior cannot be verified, identify the required contract instead of building a competing implementation.
- Avoid duplicate tracking: use either the tracker contract or existing custom behavior according to the user's stated migration scope.
- Do not confuse the hosted lead-form script (`/api/script.js`) with existing-form submission tracking (`/api/forms/script.js`). A site may use either or both according to the requested integration.

## Verification Checklist

- The original script format still works when no new options are present.
- The intended static and dynamic triggers open the shared lead form.
- Each trigger submits the expected subject, or no subject when omitted.
- `data-wa-floating-button="false"` is present only when requested.
- Programmatic calls cannot run before the script is ready.
- Existing navigation or form submission does not fire alongside the widget.
- Each tracked existing form has a unique matching selector registered in the Forms screen and the forms script is loaded exactly once.
- Existing-form submission behavior remains unchanged, and at least one of name, email, or phone can be recognized.
- Project tests, lint, and build checks relevant to changed files pass.

---
name: integrate-whatsapp-tracking
description: Integrate the production-compatible WhatsApp Tracking lead-form widget into websites and web applications. Use when Codex needs to add the tracker script, connect existing or dynamically rendered buttons and links, assign per-trigger lead subjects, disable the injected floating button, call the public JavaScript API, or verify an existing WhatsApp Tracking integration without breaking its current production behavior.
---

# Integrate WhatsApp Tracking

Connect a target website to the hosted WhatsApp Tracking widget while preserving existing markup, framework conventions, analytics, and default production behavior.

## Workflow

1. Read the target repository instructions and inspect its framework, script-loading convention, tests, and existing tracker integration.
2. Find an existing `/api/script.js?accountId=...` tag before adding another one. Reuse its host and account ID. Never invent either value; ask the user when they cannot be discovered.
3. Identify every requested trigger and decide whether declarative attributes or the JavaScript API fit the component lifecycle.
4. Make the smallest additive change. Do not recreate the modal, submit directly to `/api/conversion`, add a separate click handler, or implement attendant routing in the target project.
5. Verify behavior proportionately using the project test suite or a local browser. Confirm that opted-in controls open the form and their original action does not also run.
6. Report the edited files, integration mode, subjects used, and any configuration the user must supply.

## Integration Contract

### Preserve the default script

Use the existing production format when the floating button should remain:

```html
<script src="https://TRACKER_HOST/api/script.js?accountId=ACCOUNT_ID"></script>
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

### Disable only the floating button

When the user wants only page-owned triggers or programmatic opening, add the exact script attribute:

```html
<script
  src="https://TRACKER_HOST/api/script.js?accountId=ACCOUNT_ID"
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

## Verification Checklist

- The original script format still works when no new options are present.
- The intended static and dynamic triggers open the shared lead form.
- Each trigger submits the expected subject, or no subject when omitted.
- `data-wa-floating-button="false"` is present only when requested.
- Programmatic calls cannot run before the script is ready.
- Existing navigation or form submission does not fire alongside the widget.
- Project tests, lint, and build checks relevant to changed files pass.

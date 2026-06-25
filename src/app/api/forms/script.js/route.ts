import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asTrimmedString } from "@/lib/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = asTrimmedString(searchParams.get("accountId"), 128);

  if (!accountId) {
    return new NextResponse("console.error('Missing accountId');", {
      status: 400,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        buttonConfig: { select: { gclidExpirationDays: true } },
        formTrackings: {
          where: { isActive: true },
          select: { id: true, name: true, selector: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!account) {
      return new NextResponse("console.error('Account not found');", {
        status: 404,
        headers: { "Content-Type": "application/javascript" },
      });
    }

    const hostUrl = new URL(request.url).origin;
    const expirationDays = Math.min(Math.max(account.buttonConfig?.gclidExpirationDays || 30, 1), 365);
    const clientConfig = JSON.stringify({
      accountId,
      hostUrl,
      expirationDays,
      forms: account.formTrackings,
    });

    const scriptContent = `
(function() {
  const CONFIG = ${clientConfig};
  const FIELD_PATTERNS = {
    name: [
      'name', 'nome', 'full_name', 'fullname', 'first_name', 'firstname', 'last_name', 'lastname',
      'nome_completo', 'customer_name', 'client_name', 'lead_name', 'contact_name', 'your_name',
      'visitor_name', 'person_name', 'username', 'user_name', 'NAME', 'Nome'
    ],
    email: [
      'email', 'e-mail', 'mail', 'user_email', 'customer_email', 'client_email', 'lead_email',
      'contact_email', 'your_email', 'visitor_email', 'correo', 'email_address', 'E-mail', 'Email'
    ],
    phone: [
      'phone', 'telefone', 'tel', 'telephone', 'celular', 'mobile', 'mobile_number', 'phone_number',
      'whatsapp', 'whats', 'whatsapp_phone', 'cellphone', 'cell_phone', 'contact_phone',
      'customer_phone', 'client_phone', 'lead_phone', 'telefone_celular', 'numero', 'fone',
      'Phone', 'Telefone', 'Telephone', 'Celular'
    ]
  };

  function handleTrackingParams() {
    const params = new URLSearchParams(window.location.search);
    ['gclid', 'gbraid', 'wbraid'].forEach(function(key) {
      const value = params.get(key);
      if (!value) return;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + CONFIG.expirationDays);
      localStorage.setItem('wa_tracking_' + key, JSON.stringify({
        value: value,
        expires: expirationDate.getTime()
      }));
    });
  }

  function getTrackingParam(key) {
    const item = localStorage.getItem('wa_tracking_' + key);
    if (!item) return null;
    try {
      const parsed = JSON.parse(item);
      if (new Date().getTime() > parsed.expires) {
        localStorage.removeItem('wa_tracking_' + key);
        return null;
      }
      return parsed.value;
    } catch(e) {
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function escapeIdentifier(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/["\\\\]/g, '\\\\$&');
  }

  function getLabelText(field) {
    const labels = [];
    if (field.id) {
      const explicitLabel = document.querySelector('label[for="' + escapeIdentifier(field.id) + '"]');
      if (explicitLabel) labels.push(explicitLabel.textContent || '');
    }
    const parentLabel = field.closest('label');
    if (parentLabel) labels.push(parentLabel.textContent || '');
    return labels.join(' ');
  }

  function candidateText(field) {
    return [
      field.getAttribute('name'),
      field.id,
      field.getAttribute('autocomplete'),
      field.getAttribute('placeholder'),
      field.getAttribute('aria-label'),
      getLabelText(field)
    ].map(normalizeText).join(' ');
  }

  function scoreField(field, kind) {
    const type = normalizeText(field.getAttribute('type'));
    const autocomplete = normalizeText(field.getAttribute('autocomplete'));
    const text = candidateText(field);
    let score = 0;

    if (kind === 'email' && type === 'email') score += 80;
    if (kind === 'phone' && (type === 'tel' || autocomplete.includes('tel'))) score += 80;
    if (kind === 'name' && autocomplete === 'name') score += 80;

    FIELD_PATTERNS[kind].forEach(function(pattern) {
      const normalizedPattern = normalizeText(pattern);
      if (!normalizedPattern) return;
      if (text === normalizedPattern) score += 60;
      if (text.split(' ').includes(normalizedPattern)) score += 35;
      if (text.includes(normalizedPattern)) score += 20;
    });

    return score;
  }

  function getCandidateFields(form) {
    return Array.from(form.querySelectorAll('input, textarea, select')).filter(function(field) {
      const type = normalizeText(field.getAttribute('type'));
      return !['submit', 'button', 'reset', 'password', 'file', 'hidden'].includes(type) && !field.disabled;
    });
  }

  function pickField(fields, kind, usedFields) {
    let best = null;
    let bestScore = 0;
    fields.forEach(function(field) {
      if (usedFields.has(field)) return;
      const score = scoreField(field, kind);
      if (score > bestScore) {
        best = field;
        bestScore = score;
      }
    });
    if (best && bestScore >= 20) {
      usedFields.add(best);
      return best;
    }
    return null;
  }

  function collectLeadData(form) {
    const fields = getCandidateFields(form);
    const usedFields = new Set();
    const nameField = pickField(fields, 'name', usedFields);
    const emailField = pickField(fields, 'email', usedFields);
    const phoneField = pickField(fields, 'phone', usedFields);

    return {
      name: nameField ? String(nameField.value || '').trim() || null : null,
      email: emailField ? String(emailField.value || '').trim() || null : null,
      phone: phoneField ? String(phoneField.value || '').replace(/\\D/g, '') || null : null
    };
  }

  function currentUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function trackFormSubmit(formConfig, form) {
    const lead = collectLeadData(form);
    if (!lead.name && !lead.email && !lead.phone) return;

    const payload = {
      accountId: CONFIG.accountId,
      formTrackingId: formConfig.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      gclid: getTrackingParam('gclid'),
      gbraid: getTrackingParam('gbraid'),
      wbraid: getTrackingParam('wbraid'),
      utm_source: currentUrlParam('utm_source'),
      utm_medium: currentUrlParam('utm_medium'),
      utm_campaign: currentUrlParam('utm_campaign')
    };

    try {
      fetch(CONFIG.hostUrl + '/api/form-conversion?accountId=' + encodeURIComponent(CONFIG.accountId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function(err) {
        console.warn('[WA Tracker Forms] Lead tracking failed', err);
      });
    } catch (err) {
      console.warn('[WA Tracker Forms] Lead tracking failed', err);
    }
  }

  function bindForm(formConfig, form) {
    if (form.__waTrackerFormsBound) return;
    form.__waTrackerFormsBound = true;
    form.addEventListener('submit', function() {
      trackFormSubmit(formConfig, form);
    }, true);
  }

  function bindConfiguredForms() {
    if (!document || typeof document.querySelectorAll !== 'function') return;
    CONFIG.forms.forEach(function(formConfig) {
      let forms = [];
      try {
        forms = Array.from(document.querySelectorAll(formConfig.selector));
      } catch (err) {
        console.warn('[WA Tracker Forms] Invalid selector', formConfig.selector, err);
        return;
      }

      forms
        .filter(function(element) { return element && element.tagName === 'FORM'; })
        .forEach(function(form) { bindForm(formConfig, form); });
    });
  }

  handleTrackingParams();
  bindConfiguredForms();
  window.setTimeout(bindConfiguredForms, 500);
  window.setTimeout(bindConfiguredForms, 1500);
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(function() {
      bindConfiguredForms();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
`;

    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("console.error('Failed to load forms tracking script');", {
      status: 500,
      headers: { "Content-Type": "application/javascript" },
    });
  }
}

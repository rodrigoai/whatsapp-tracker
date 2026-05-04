import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get("accountId")

  if (!accountId) {
    return new NextResponse("console.error('Missing accountId');", {
      status: 400,
      headers: { "Content-Type": "application/javascript" },
    })
  }

  try {
    const config = await prisma.buttonConfig.findUnique({
      where: { accountId },
    })

    const position = config?.position === "LEFT" ? "left: 20px;" : "right: 20px;"
    const size = config?.size === "SMALL" ? "36px" : "48px"
    const color = config?.primaryColor || "#25D366"
    const text = config?.buttonText || "Chat with us"
    const expirationDays = config?.gclidExpirationDays || 30

    // Get the base URL of the host serving this script to use for API calls
    const hostUrl = new URL(request.url).origin

    const scriptContent = `
(function() {
  // Config
  const CONFIG = {
    accountId: "${accountId}",
    hostUrl: "${hostUrl}",
    position: "${position}",
    size: "${size}",
    color: "${color}",
    text: "${text}",
    expirationDays: ${expirationDays}
  };

  // Tracking Parameters Handler
  function handleTrackingParams() {
    const params = new URLSearchParams(window.location.search);
    ['gclid', 'gbraid', 'wbraid'].forEach(key => {
      const value = params.get(key);
      if (value) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + CONFIG.expirationDays);
        localStorage.setItem('wa_tracking_' + key, JSON.stringify({
          value: value,
          expires: expirationDate.getTime()
        }));
      }
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

  handleTrackingParams();

  // Inject CSS
  const style = document.createElement('style');
  style.innerHTML = \`
    #wa-tracking-widget {
      position: fixed;
      bottom: 20px;
      \${CONFIG.position}
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #wa-tracking-button {
      background-color: \${CONFIG.color};
      color: white;
      border: none;
      border-radius: 50px;
      height: \${CONFIG.size};
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-weight: 600;
      transition: transform 0.2s ease;
    }
    #wa-tracking-button:hover {
      transform: scale(1.05);
    }
    #wa-tracking-modal {
      display: none;
      position: fixed;
      bottom: 80px;
      \${CONFIG.position}
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      width: 300px;
      padding: 20px;
      z-index: 1000000;
      color: #333;
    }
    .wa-tracking-input {
      width: 100%;
      padding: 10px;
      margin-bottom: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 14px;
    }
    #wa-tracking-submit {
      width: 100%;
      background-color: \${CONFIG.color};
      color: white;
      border: none;
      border-radius: 6px;
      padding: 12px;
      font-weight: bold;
      cursor: pointer;
      margin-bottom: 8px;
    }
    #wa-tracking-skip {
      width: 100%;
      background: transparent;
      color: #666;
      border: none;
      padding: 8px;
      cursor: pointer;
      text-decoration: underline;
      font-size: 13px;
    }
    #wa-tracking-close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #999;
    }
    #wa-tracking-error {
      color: red;
      font-size: 12px;
      margin-bottom: 10px;
      display: none;
    }
  \`;
  document.head.appendChild(style);

  // Inject HTML
  const widget = document.createElement('div');
  widget.id = 'wa-tracking-widget';
  
  const button = document.createElement('button');
  button.id = 'wa-tracking-button';
  button.innerHTML = \`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
    \${CONFIG.text}
  \`;

  const modal = document.createElement('div');
  modal.id = 'wa-tracking-modal';
  modal.innerHTML = \`
    <button id="wa-tracking-close">&times;</button>
    <h3 style="margin-top:0; margin-bottom: 16px; font-size:18px;">Start Chat</h3>
    <p style="font-size:13px; color:#666; margin-bottom:16px;">Please provide your details before we connect you to an attendant.</p>
    <div id="wa-tracking-error"></div>
    <form id="wa-tracking-form">
      <input type="text" id="wa-name" class="wa-tracking-input" placeholder="Your Name" required />
      <input type="email" id="wa-email" class="wa-tracking-input" placeholder="Your Email" required />
      <input type="tel" id="wa-phone" class="wa-tracking-input" placeholder="Your Phone (e.g. 11999999999)" required />
      <button type="submit" id="wa-tracking-submit">Continue to Chat</button>
      <button type="button" id="wa-tracking-skip">Skip & Chat as Anonymous</button>
    </form>
  \`;

  widget.appendChild(button);
  document.body.appendChild(widget);
  document.body.appendChild(modal);

  // Events
  button.addEventListener('click', () => {
    modal.style.display = 'block';
  });

  document.getElementById('wa-tracking-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Function to perform the redirect
  const redirectToWhatsApp = (mobileUrl, desktopUrl) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    window.location.href = isMobile ? mobileUrl : desktopUrl;
  };

  // Form submission
  document.getElementById('wa-tracking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('wa-name').value;
    const email = document.getElementById('wa-email').value;
    const phone = document.getElementById('wa-phone').value;
    const submitBtn = document.getElementById('wa-tracking-submit');
    const errorDiv = document.getElementById('wa-tracking-error');
    
    submitBtn.innerText = 'Connecting...';
    submitBtn.disabled = true;
    errorDiv.style.display = 'none';

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utm_source = urlParams.get('utm_source');
      const utm_medium = urlParams.get('utm_medium');
      const utm_campaign = urlParams.get('utm_campaign');

      const response = await fetch(\`\${CONFIG.hostUrl}/api/conversion\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: CONFIG.accountId,
          name,
          email,
          phone,
          gclid: getTrackingParam('gclid'),
          gbraid: getTrackingParam('gbraid'),
          wbraid: getTrackingParam('wbraid'),
          utm_source,
          utm_medium,
          utm_campaign
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        redirectToWhatsApp(data.mobileUrl, data.desktopUrl);
      } else {
        throw new Error(data.error || 'Failed to connect');
      }
    } catch (err) {
      errorDiv.innerText = err.message;
      errorDiv.style.display = 'block';
      submitBtn.innerText = 'Continue to Chat';
      submitBtn.disabled = false;
    }
  });

  // Skip functionality
  document.getElementById('wa-tracking-skip').addEventListener('click', async () => {
    // Generate an anonymous lead
    try {
      const response = await fetch(\`\${CONFIG.hostUrl}/api/conversion\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: CONFIG.accountId,
          name: "Anonymous",
          email: "anonymous@example.com",
          phone: "0000000000",
          gclid: getTrackingParam('gclid'),
          gbraid: getTrackingParam('gbraid'),
          wbraid: getTrackingParam('wbraid')
        })
      });
      const data = await response.json();
      if(response.ok) {
        redirectToWhatsApp(data.mobileUrl, data.desktopUrl);
      } else {
        alert("Unable to connect at the moment.");
      }
    } catch(err) {
      alert("Unable to connect at the moment.");
    }
  });

})();
  `;

    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error(error)
    return new NextResponse("console.error('Failed to load tracking script');", {
      status: 500,
      headers: { "Content-Type": "application/javascript" },
    })
  }
}

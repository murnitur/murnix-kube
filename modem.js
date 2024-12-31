// State management

const STATE_DEFAULT = {
  loading: true,
  hasError: false,
  success: false,
  errorMessage: "",
  modal: null,
  paymentIntent: null,
  view: "wallet",
  valid: true,
  payment_account: "",
  card: "",
  cvv: "",
  expiry: "",
  gateway: "",
  close: closeModal,
  payload: null,
};

const url = "http://localhost:9090/api/payment-intents";
const backdropId = "modem-pay-backdrop";
const modalId = "modem-pay-modal";

let state = STATE_DEFAULT;

// Main function to trigger modal and create payment intent
const ModemPayCheckout = (payload) => {
  preamble(payload);
  createPaymentIntent(payload);
  return state;
};

// Utilities

const createElement = (tag, id, attributes = {}) => {
  const el = document.createElement(tag);
  el.id = id;
  Object.entries(attributes).forEach(([key, value]) => {
    el[key] = value;
  });
  return el;
};

const validateCard = (value) => {
  const sanitized = value.replace(/\s+/g, "");
  const isVisaOrMastercard = /^(4|5[1-5]|2)/.test(sanitized);
  const isCorrectLength = sanitized.length === 16;

  return isVisaOrMastercard && isCorrectLength && luhnCheck(sanitized);
};

const luhnCheck = (number) => {
  let sum = 0;
  let shouldDouble = false;

  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

const formatCash = (cash, currency) => {
  return new Intl.NumberFormat("en-GB", {
    currency,
    style: "currency",
  }).format(cash);
};

const collectAdditionalInfo = async () => {
  try {
    // Get IP address
    const response = await fetch("https://api.ipify.org?format=json");
    if (response.ok) {
      const data = await response.json();
      const ipAddress = data.ip;

      // Get device and browser information
      const userAgent = navigator.userAgent;
      const deviceType = /Mobile|Android|iP(hone|ad|od)/.test(userAgent)
        ? "Mobile"
        : "Desktop";
      const browser = (() => {
        const { userAgent } = navigator;
        if (/firefox|fxios/i.test(userAgent)) return "Firefox";
        if (/chrome|chromium|crios/i.test(userAgent)) return "Chrome";
        if (/safari/i.test(userAgent)) return "Safari";
        if (/msie|trident/i.test(userAgent)) return "Internet Explorer";
        if (/edg/i.test(userAgent)) return "Edge";
        return "Unknown Browser";
      })();
      const os = (() => {
        const { platform } = navigator;
        if (/Win/.test(platform)) return "Windows";
        if (/Mac/.test(platform)) return "MacOS";
        if (/Linux/.test(platform)) return "Linux";
        if (/Android/.test(platform)) return "Android";
        if (/iPhone|iPad|iPod/.test(platform)) return "iOS";
        return "Unknown OS";
      })();

      // Collect all information
      const additionalInfo = {
        ipAddress,
        urlIPAddress: `https://db-ip.com/${ipAddress}`,
        deviceType,
        browser,
        os,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timestamp: new Date().toISOString(),
      };

      return additionalInfo;
    }
    return {};
  } catch (error) {
    return { error: "Failed to collect additional information" };
  }
};

// API Interactions

const createPaymentIntent = async (payload) => {
  try {
    if (!payload?.amount)
      throw new Error("Please specify the amount intended to pay.");

    state.loading = true;
    reloadUI();

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { ...payload, public: true, inline: true },
      }),
    });

    if (!response.ok)
      throw new Error(
        `Error: ${response.status} - ${(await response.json())["message"]}`
      );

    const intent = {
      ...(await response.json()),
      public_key: payload["public_key"],
    };
    state.paymentIntent = intent;
    state.view = intent.payment_methods[0];
    state.loading = false;
    reloadUI();
  } catch (error) {
    handleError(error);
  }
};

const cancelPayment = async () => {
  try {
    const cancelled = window.confirm(
      "Are you sure you want to cancel this payment?"
    );
    if (cancelled) {
      state.loading = true;
      reloadUI();
      // cancel payment intent
      const response = await fetch(`${url}/${state.paymentIntent.id}`, {
        method: "PATCH",
      });

      if (!response.ok)
        throw new Error(
          `Error: ${response.status} - ${(await response.json())["message"]}`
        );
      if (state.paymentIntent.cancel_url) {
        window.location.assign(state.paymentIntent.cancel_url);
      } else {
        closeModal(true);
      }
    }
  } catch (error) {
    handleError(error);
  }
};

const charge = async (event) => {
  try {
    // Prevent default form submission
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Update state
    state.loading = true;
    state.card = formData.get("card") ?? "";
    state.cvv = formData.get("cvv") ?? "";
    state.gateway = formData.get("gateway") ?? "";
    state.payment_account = formData.get("payment_account") ?? "";
    state.expiry = formData.get("expiry") ?? "";

    reloadUI(); // Update UI with new state

    // Validate card details if view is "card"
    if (state.view === "card") {
      const isValid = validateCard(state.card);
      if (!isValid) {
        state.hasError = true;
        state.errorMessage = "Invalid Payment Card";
        state.loading = false;
        reloadUI();
        return; // Stop further execution
      }
    }

    // Proceed if no errors
    if (!state.hasError) {
      const additionalInfo = await collectAdditionalInfo();
      const payload = {
        data: {
          business_id: state.paymentIntent?.business_id,
          selected_payment_method: state.view,
          card: state.card,
          cvv: state.cvv,
          expiry: state.expiry,
          gateway: state.view === "card" ? "card" : state.gateway,
          intent_id: state.paymentIntent?.id,
          payment_account: state.payment_account,
          amount: state.paymentIntent?.amount,
          useSelectedPaymentMethod: false,
          from_inline: true,
          payment_metadata: additionalInfo,
        },
      };

      // Send request to server
      const response = await fetch(`${url}/charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Handle response
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error: ${response.status} - ${errorData?.message}`);
      }

      const data = await response.json();
      if (data.return_url) {
        window.location.assign(data.return_url);
      } else {
        state.success = true;
        reloadUI();
        if (state.payload.callback) {
          state.payload.callback(data);
        } else {
          closeModal();
        }
      }
    }
  } catch (error) {
    handleError(error);
  } finally {
    // Reset loading state
    state.loading = false;
    reloadUI();
  }
};

// Event Handlers

const attachFormListeners = () => {
  const form = document.querySelector("#form");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      charge(event);
    });
  }
};

const attachPaymentMethodListeners = () => {
  const buttons = document.querySelectorAll(".payment-method-btn");
  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const selectedMethod = event.target.dataset.method;
      handlePaymentMethodChange(selectedMethod);
    });
  });
};

const attachCancelListener = () => {
  const cancelButton = document.querySelector(".cancel-button");
  if (cancelButton) {
    cancelButton.addEventListener("click", cancelPayment);
  }
};

const handlePaymentMethodChange = (method) => {
  state.view = method;
  state.payment_account = "";
  state.gateway = "";
  state.cvv = "";
  state.card = "";
  state.expiry = "";
  reloadUI();
};

// Error Handlers

const handleError = (error) => {
  state.loading = false;
  state.hasError = true;
  state.errorMessage = error.message;
  reloadUI();
};

// Modal Management

const preamble = (payload) => {
  state = STATE_DEFAULT;
  const backdropEl = createElement("div", backdropId, {
    id: backdropId,
    className: backdropId,
  });
  const modalEl = createElement("div", modalId, {
    onclick: (e) => e.stopPropagation(),
    id: modalId,
    className: modalId,
  });

  modalEl.innerHTML = modalUI(payload);
  backdropEl.append(modalEl);
  document.body.appendChild(backdropEl);
  state.modal = modalEl;
  state.payload = payload;
};

function closeModal(force = false) {
  const backdrop = document.getElementById(backdropId);
  if (backdrop) {
    if (force && state.payload.onClose) {
      state.payload.onClose(true);
    } else if (state.payload.onClose) {
      state.payload.onClose(false);
    }
    cleanUp();
    backdrop.remove();
  }
}

const cleanUp = () => {
  state.card = "";
  state.cvv = "";
  state.payment_account = "";
  state.loading = true;
  state.hasError = false;
  state.gateway = "";
  state.expiry = "";
  state.paymentIntent = null;
  state.modal = null;
  state.success = false;
};

// Dynamic UI Updates
const modalUI = () => {
  if (state.loading) {
    return loadingUI();
  } else if (state.hasError) {
    return errorUI();
  } else if (state.success) {
    return successUI();
  } else if (state.paymentIntent) {
    return getView();
  }
  return closeModal(true);
};

const reloadUI = () => {
  if (state.modal) {
    state.modal.innerHTML = modalUI();
    attachPaymentMethodListeners();
    attachFormListeners();
    attachCancelListener();
  }
};

const retry = () => {
  state.loading = false;
  state.hasError = false;
  reloadUI();
};

// Views

const loadingUI = () => `
  <div class="modem-pay-dots-loading">
    <div></div>
  </div>`;

const errorUI = () => `
  <div class="modem-pay-error">
    <i class="fas fa-xmark"></i>
    <p>${state.errorMessage}</p>
    <button class="retry" onClick="retry()">Retry</button>
  </div>`;

const successUI =
  () => `<div class="modem-pay-success"><h2>Thanks for your payment!</h2>
      <p>Your transaction was completed successfully.</p></div>`;

const getView = () => {
  const methodOptions = state.paymentIntent.payment_method_options || [];
  const title = state.paymentIntent.title ?? "Payment Checkout";
  const description =
    state.paymentIntent.description ??
    "Complete your payment below to finalize the transaction";
  const amount =
    state.paymentIntent.amount > 0
      ? formatCash(state.paymentIntent.amount, state.paymentIntent.currency)
      : "";

  return `
    <h2>${title}</h2>
    <p>${description}</p>
    <div class="modem-pay-amount" id="amount">
      ${amount}
    </div>
    <form action="#" method="POST" id="form">
            ${
              ["bank", "wallet"].includes(state.view)
                ? walletUI(methodOptions)
                : cardUI()
            }
    <input type="hidden"
                value="${state.paymentIntent.public_key}"
                name="public_key"
              />
              <input
                type="submit"
                value="Pay ${amount}"
              />
              <button
                  type="button"
                  onClick="cancelPayment.bind(this)"
                  class="cancel-button"
                >
                  Cancel Payment
                </button>
                 
  </form>

  ${
    state.paymentIntent.payment_methods.length > 1
      ? `<div class="modem-pay-change-payment">
           <p>Pay With</p>
           <div class='modem-pay-methods'>
             ${state.paymentIntent.payment_methods
               .filter((c) => c != state.view)
               .map(
                 (m) =>
                   `<button class="payment-method-btn" data-method="${m}">
                     ${m}
                    </button>`
               )
               .join("")}
           </div>
         </div>`
      : ""
  }
            <div id="tag-container">
              <div id="tag-protection">
                <i className="fas fa-lock"></i>
                <span>Secured by Modem Pay</span>
              </div>
            </div>
          </div>
  `;
};

// Widgets
const walletUI = (methodOptions) => `
  <div class="modem-pay-card-layout">
    <div class="modem_pay_form_group_card">
      <label for="gateway">Wallet Account</label>
      <select id="gateway" value="${state.gateway}" name="gateway" required>
        <option value="" disabled>Select your wallet</option>
        ${methodOptions
          .filter((option) => option.group === state.view)
          .map(
            (option) => `
          <option key="${option.tag}" value="${option.tag}">
            ${option.name}
          </option>`
          )
          .join("")}
      </select>
    </div>
    <div class="modem_pay_form_group_card">
      <label for="payment_account">Wallet Account Number</label>
      <input value="${
        state.payment_account
      }" type="text" id="payment_account" name="payment_account" placeholder="Enter your wallet account number" minlength="7" required />
    </div>
  </div>`;

const cardUI = () => `
  <div class="modem-pay-card-layout">
    <div class="modem_pay_form_group_card">
      <label for="card">Card number</label>
      <input value="${state.card}" type="text" name="card" id="card" required placeholder="Enter your card number"/>
    </div>
    <div class="modem_pay_form_group_card">
      <label for="expiry">Expiry date</label>
      <input value="${state.expiry}" type="month" name="expiry" id="expiry" required placeholder="Enter your card expiry date"/>
    </div>
    <div class="modem_pay_form_group_card">
      <label for="cvv">CVV</label>
      <input value="${state.cvv}" type="text" name="cvv" id="cvv" required placeholder="Enter your card cvv" minlength="3"/>
    </div>
  </div>`;

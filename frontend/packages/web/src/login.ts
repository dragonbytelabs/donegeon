type OTPRequestResponse = {
  ok: boolean;
  expiresAt?: string;
  error?: string;
};

type OTPVerifyResponse = {
  ok: boolean;
  error?: string;
};

function qs<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

const emailStep = qs<HTMLFormElement>("emailStep");
const otpStep = qs<HTMLFormElement>("otpStep");
const emailInput = qs<HTMLInputElement>("emailInput");
const otpInput = qs<HTMLInputElement>("otpInput");
const otpEmailLabel = qs<HTMLSpanElement>("otpEmailLabel");
const otpBack = qs<HTMLButtonElement>("otpBack");
const loginStatus = qs<HTMLDivElement>("loginStatus");

let currentEmail = "";

function setStatus(msg: string, isError = false): void {
  loginStatus.textContent = msg;
  loginStatus.classList.toggle("text-red-400", isError);
  loginStatus.classList.toggle("text-muted-foreground", !isError);
}

function showOTPStep(email: string): void {
  currentEmail = email;
  otpEmailLabel.textContent = email;
  emailStep.classList.add("hidden");
  otpStep.classList.remove("hidden");
  otpInput.focus();
}

function showEmailStep(): void {
  otpStep.classList.add("hidden");
  emailStep.classList.remove("hidden");
  emailInput.focus();
}

async function requestOTP(email: string): Promise<OTPRequestResponse> {
  const res = await fetch("/api/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

async function verifyOTP(email: string, code: string): Promise<OTPVerifyResponse> {
  const res = await fetch("/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return res.json();
}

emailStep.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    setStatus("Email is required.", true);
    return;
  }

  setStatus("Requesting OTP...");

  try {
    const data = await requestOTP(email);
    if (!data.ok) {
      setStatus(data.error || "Could not request OTP.", true);
      return;
    }
    showOTPStep(email);
    setStatus("OTP sent. Check backend logs for the 6-digit code.");
  } catch (err: any) {
    setStatus(String(err?.message || err), true);
  }
});

otpBack.addEventListener("click", () => {
  showEmailStep();
  setStatus("");
});

otpStep.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = otpInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    setStatus("Code must be 6 digits.", true);
    return;
  }

  setStatus("Verifying OTP...");

  try {
    const data = await verifyOTP(currentEmail, code);
    if (!data.ok) {
      setStatus(data.error || "OTP verification failed.", true);
      return;
    }
    setStatus("Signed in. Redirecting...");
    window.location.href = "/app";
  } catch (err: any) {
    setStatus(String(err?.message || err), true);
  }
});


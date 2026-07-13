// Gappon web purchase page logic.
// Sign in with the account you want to unlock, then grant the annual `premium`
// entitlement to that Firebase UID via RevenueCat Web Billing (appUserId = UID).
// See Context Vault billing-plan.md / ADR-003..005.
//
// Every key in this file is a publishable public key (Firebase web config and the
// RevenueCat Web Billing public key), so it is safe to commit. Never place a secret key here.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { Purchases, PurchasesError, ErrorCode } from "https://esm.sh/@revenuecat/purchases-js@1";

// ---------------------------------------------------------------------------
// Config (public keys)
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyBkh_Os1ACs1ZrDYnO5oOmNDpkuMEzlBh4",
  authDomain: "japaneseldsquad.firebaseapp.com",
  projectId: "japaneseldsquad",
  storageBucket: "japaneseldsquad.appspot.com",
  messagingSenderId: "1096784941738",
  appId: "1:1096784941738:web:81c815b8c10892a3c836d3",
};

const REVENUECAT_WEB_BILLING_KEY = "rcb_XASpjJodgscKjHwDTIyiMMJdJOAc";
const ENTITLEMENT_ID = "premium";
const OFFERING_ID = "default"; // Offering that contains the annual package ($rc_annual)

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

const I18N = {
  ja: {
    title: "Gappon Premium のご購入",
    lead:
      "年額サブスクリプションで、Gappon のすべての機能をご利用いただけます。アップグレードするアカウントでサインインし、ご購入手続きを完了してください。アプリで同じアカウントにサインインすると、全機能をご利用いただけます。",
    loading: "読み込み中…",
    label_email: "メールアドレス",
    label_password: "パスワード",
    btn_signin: "サインイン",
    link_forgot: "パスワードをお忘れの場合",
    note_signedout:
      "Gappon アプリで作成したアカウントでサインインしてください。アカウントをお持ちでない場合は、先にアプリでの作成をお願いいたします。",
    signed_in_as: "サインイン中のアカウント",
    plan_name: "年額サブスクリプション",
    btn_purchase: "お支払いへ進む",
    btn_signout: "サインアウト",
    btn_manage: "サブスクリプションを管理",
    note_signedin:
      "お支払いは Stripe により安全に処理されます。年額の自動更新で、いつでも解約いただけます。",
    status_title: "サブスクリプションが有効です",
    active_body:
      "このアカウントは Gappon の全機能をご利用いただけます。お使いの端末のアプリで、このアカウントにサインインしてください。",
    banner_thanks: "Gappon Premium にご登録いただきありがとうございます。",
    expiry_renews: "次回更新日 {date}",
    expiry_until: "利用期限 {date}",
    note_account:
      "ご利用権はこのアカウントに紐づいています。メールアドレスとパスワードは大切に保管してください。再度ご利用になるには、同じアカウントへのサインインが必要です。",
    price_fallback: "年額 $9.99",
    err_fill_credentials: "メールアドレスとパスワードをご入力ください。",
    err_invalid_email: "有効なメールアドレスをご入力ください。",
    err_invalid_credential: "メールアドレスまたはパスワードが正しくありません。",
    err_too_many: "試行回数が上限に達しました。しばらくしてからお試しください。",
    err_network: "ネットワークエラーが発生しました。接続をご確認のうえ、再度お試しください。",
    err_signin_generic: "サインインできませんでした。しばらくしてから再度お試しください。",
    err_fill_email_reset: "パスワードを再設定するメールアドレスをご入力ください。",
    info_reset_sent: "{email} 宛にパスワード再設定の手順をお送りしました。",
    err_get_info: "サブスクリプション情報を取得できませんでした。しばらくしてから再度お試しください。",
    err_no_plan:
      "現在ご利用いただけるプランがありません。しばらくしてからお試しください。",
    err_purchase_start:
      "購入手続きを開始できませんでした。ページを再読み込みのうえ、再度お試しください。",
    err_purchase_pending:
      "お支払いを受け付けました。反映まで数分かかる場合があります。しばらくしてからアプリでご確認ください。",
    err_purchase_generic:
      "お支払いの処理中に問題が発生しました。しばらくしてから再度お試しください。",
  },
  en: {
    title: "Get Gappon Premium",
    lead:
      "Unlock every Gappon feature with an annual subscription. Sign in to the account you'd like to upgrade, complete your purchase, then sign in to that same account in the app to enjoy full access.",
    loading: "Loading…",
    label_email: "Email",
    label_password: "Password",
    btn_signin: "Sign in",
    link_forgot: "Forgot your password?",
    note_signedout:
      "Please sign in with the account you created in the Gappon app. If you don't have one yet, please create it in the app first.",
    signed_in_as: "Signed in as",
    plan_name: "Annual subscription",
    btn_purchase: "Continue to payment",
    btn_signout: "Sign out",
    btn_manage: "Manage subscription",
    note_signedin:
      "Payments are processed securely by Stripe. Your subscription renews annually and can be canceled at any time.",
    status_title: "Your subscription is active",
    active_body:
      "This account has full access to all Gappon features. Sign in to the app with this account to use them on your devices.",
    banner_thanks: "Thank you for subscribing to Gappon Premium.",
    expiry_renews: "Renews on {date}",
    expiry_until: "Access until {date}",
    note_account:
      "Your access is linked to this account. Please keep your email and password secure — you'll need to sign in to this same account to regain access.",
    price_fallback: "$9.99 / year",
    err_fill_credentials: "Please enter your email and password.",
    err_invalid_email: "Please enter a valid email address.",
    err_invalid_credential: "The email or password is incorrect.",
    err_too_many: "Too many attempts. Please try again later.",
    err_network: "A network error occurred. Please check your connection and try again.",
    err_signin_generic: "We couldn't sign you in. Please try again later.",
    err_fill_email_reset: "Please enter your email address to reset your password.",
    info_reset_sent: "We've sent password reset instructions to {email}.",
    err_get_info: "We couldn't load your subscription details. Please try again later.",
    err_no_plan: "No plan is available at the moment. Please try again later.",
    err_purchase_start: "We couldn't start the purchase. Please reload the page and try again.",
    err_purchase_pending:
      "Your payment was received. It may take a few minutes to activate — please check the app shortly.",
    err_purchase_generic: "Something went wrong during payment. Please try again later.",
  },
};

// Language is owned by the shared site-wide runtime (assets/js/i18n.js), which
// handles detection, persistence, the header toggle, and <html lang>. This page
// keeps its own richer string table (I18N) for the billing-specific and dynamic
// copy, and re-renders it whenever the shared runtime reports a language change.
let currentLang = window.Gappon?.i18n?.getLang?.() ?? "ja";

function t(key, params) {
  let s = I18N[currentLang]?.[key] ?? I18N.ja[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/** @type {import("https://esm.sh/@revenuecat/purchases-js@1").Purchases | null} */
let purchases = null;
let configuredUid = null;

// Dynamic messages currently shown (kept so we can re-render them on language switch).
const shownMessages = {}; // nodeId -> { key, params }
// Current price display state.
let priceDisplay = { fromSdk: false, text: "" };
// Active entitlement info shown on the status view (kept so the date can be
// re-rendered in the current language on a language switch).
let activeEntitlement = null; // { expirationDate: Date | null, willRenew: boolean, managementUrl: string | null }
// True right after a purchase in this session, so the status view can show a
// "thank you" banner. Reset on sign-out.
let justPurchased = false;

const el = (id) => document.getElementById(id);
const views = {
  loading: el("view-loading"),
  signedOut: el("view-signed-out"),
  signedIn: el("view-signed-in"),
  active: el("view-active"),
};

function showView(name) {
  Object.entries(views).forEach(([key, node]) => {
    if (node) node.hidden = key !== name;
  });
}

function setMsg(nodeId, key, params) {
  const node = el(nodeId);
  if (!node) return;
  if (!key) {
    delete shownMessages[nodeId];
    node.textContent = "";
    node.hidden = true;
    return;
  }
  shownMessages[nodeId] = { key, params };
  node.textContent = t(key, params);
  node.hidden = false;
}

function renderPrice() {
  const node = el("plan-price");
  if (!node) return;
  node.textContent = priceDisplay.fromSdk ? priceDisplay.text : t("price_fallback");
}

function renderActiveExpiry() {
  const node = el("active-expiry");
  if (!node) return;
  if (!activeEntitlement || !activeEntitlement.expirationDate) {
    node.textContent = "";
    node.hidden = true;
    return;
  }
  const dateStr = new Intl.DateTimeFormat(
    currentLang === "ja" ? "ja-JP" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  ).format(activeEntitlement.expirationDate);
  const key = activeEntitlement.willRenew ? "expiry_renews" : "expiry_until";
  node.textContent = t(key, { date: dateStr });
  node.hidden = false;
}

// ---------------------------------------------------------------------------
// Apply language
// ---------------------------------------------------------------------------

function applyLang(lang) {
  currentLang = lang;
  auth.languageCode = lang; // Language for Firebase emails (e.g. password reset)

  // Only this page's own keys live in I18N; site chrome (nav/footer) is handled
  // by the shared runtime, which skips keys it doesn't know, so both can safely
  // scan the same [data-i18n] elements.
  const dict = I18N[lang];
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (dict[key] != null) node.textContent = dict[key];
  });

  // Re-render dynamic elements.
  renderPrice();
  renderActiveExpiry();
  Object.entries(shownMessages).forEach(([nodeId, { key, params }]) => {
    const node = el(nodeId);
    if (node) node.textContent = t(key, params);
  });
}

// ---------------------------------------------------------------------------
// RevenueCat: configure / switch for the current UID
// ---------------------------------------------------------------------------

async function ensurePurchasesForUid(uid) {
  if (!purchases) {
    purchases = Purchases.configure(REVENUECAT_WEB_BILLING_KEY, uid);
    configuredUid = uid;
  } else if (configuredUid !== uid) {
    await purchases.changeUser(uid);
    configuredUid = uid;
  }
  return purchases;
}

function hasPremium(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);
}

function isUserCancelled(err) {
  return (
    (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) ||
    err?.errorCode === ErrorCode.UserCancelledError ||
    /cancel/i.test(err?.message || "")
  );
}

// ---------------------------------------------------------------------------
// Resolve entitlement state after sign-in
// ---------------------------------------------------------------------------

async function resolveEntitlementState(user) {
  showView("loading");
  try {
    const p = await ensurePurchasesForUid(user.uid);
    const customerInfo = await p.getCustomerInfo();

    el("account-email").textContent = user.email || "";
    el("active-email").textContent = user.email || "";

    if (hasPremium(customerInfo)) {
      const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
      const rawExpiry = ent?.expirationDate ?? null;
      activeEntitlement = {
        expirationDate: rawExpiry ? new Date(rawExpiry) : null,
        willRenew: Boolean(ent?.willRenew),
        managementUrl: customerInfo.managementURL ?? null,
      };
      renderActiveExpiry();
      const manageBtn = el("btn-manage");
      if (manageBtn) manageBtn.hidden = !activeEntitlement.managementUrl;
      const banner = el("active-banner");
      if (banner) banner.hidden = !justPurchased;
      showView("active");
    } else {
      activeEntitlement = null;
      await loadOfferingIntoUi(p);
      showView("signedIn");
    }
  } catch (err) {
    console.error("[purchase] failed to resolve entitlement", err);
    setMsg("purchase-error", "err_get_info");
    showView("signedIn");
  }
}

async function loadOfferingIntoUi(p) {
  const offerings = await p.getOfferings();
  const offering = offerings.all?.[OFFERING_ID] ?? offerings.current;
  const pkg = offering?.annual ?? null;

  const formatted = pkg?.rcBillingProduct?.currentPrice?.formattedPrice;
  if (formatted) {
    priceDisplay = { fromSdk: true, text: formatted };
  } else {
    priceDisplay = { fromSdk: false, text: "" };
  }
  renderPrice();

  const buyBtn = el("btn-purchase");
  buyBtn.disabled = !pkg;
  buyBtn._rcPackage = pkg;
  if (!pkg) {
    setMsg("purchase-error", "err_no_plan");
  } else {
    setMsg("purchase-error", null);
  }
}

// ---------------------------------------------------------------------------
// Event: sign in
// ---------------------------------------------------------------------------

async function handleSignIn(event) {
  event.preventDefault();
  setMsg("signin-error", null);
  setMsg("signin-info", null);
  const email = el("email").value.trim();
  const password = el("password").value;
  if (!email || !password) {
    setMsg("signin-error", "err_fill_credentials");
    return;
  }
  const btn = el("btn-signin");
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged handles the follow-up.
  } catch (err) {
    console.error("[purchase] sign-in error", err);
    setMsg("signin-error", authErrorKey(err));
    btn.disabled = false;
  }
}

function authErrorKey(err) {
  switch (err?.code) {
    case "auth/invalid-email":
      return "err_invalid_email";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "err_invalid_credential";
    case "auth/too-many-requests":
      return "err_too_many";
    case "auth/network-request-failed":
      return "err_network";
    default:
      return "err_signin_generic";
  }
}

// ---------------------------------------------------------------------------
// Event: password reset
// ---------------------------------------------------------------------------

async function handleForgotPassword(event) {
  event.preventDefault();
  setMsg("signin-error", null);
  setMsg("signin-info", null);
  const email = el("email").value.trim();
  if (!email) {
    setMsg("signin-error", "err_fill_email_reset");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    setMsg("signin-info", "info_reset_sent", { email });
  } catch (err) {
    console.error("[purchase] password reset error", err);
    setMsg("signin-error", authErrorKey(err));
  }
}

// ---------------------------------------------------------------------------
// Event: purchase
// ---------------------------------------------------------------------------

async function handlePurchase() {
  setMsg("purchase-error", null);
  const btn = el("btn-purchase");
  const pkg = btn._rcPackage;
  const user = auth.currentUser;
  if (!pkg || !user || !purchases) {
    setMsg("purchase-error", "err_purchase_start");
    return;
  }
  btn.disabled = true;
  try {
    // Match the hosted checkout UI to the language selected on this page (rather
    // than relying on the browser locale). RC Billing supports "ja" / "en".
    const { customerInfo } = await purchases.purchase({
      rcPackage: pkg,
      selectedLocale: currentLang,
      defaultLocale: currentLang,
    });
    if (hasPremium(customerInfo)) {
      // Merged flow: land on the unified status view with a thank-you banner.
      justPurchased = true;
      await resolveEntitlementState(user);
    } else {
      setMsg("purchase-error", "err_purchase_pending");
      btn.disabled = false;
    }
  } catch (err) {
    // Do not surface an error when the user simply closes/leaves the checkout.
    // The SDK throws a PurchasesError with errorCode ErrorCode.UserCancelledError
    // (a numeric enum) and no message, so we must compare against the enum value
    // rather than a string. The message check is a defensive fallback only.
    if (isUserCancelled(err)) {
      btn.disabled = false;
      return;
    }
    console.error("[purchase] purchase error", err);
    setMsg("purchase-error", "err_purchase_generic");
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Event: manage subscription (opens the RevenueCat/Stripe-hosted portal where
// the user can update payment or cancel — web purchases cannot be managed via
// the App Store / Play Store)
// ---------------------------------------------------------------------------

function handleManage() {
  const url = activeEntitlement?.managementUrl;
  if (url) window.open(url, "_blank", "noopener");
}

// ---------------------------------------------------------------------------
// Event: sign out
// ---------------------------------------------------------------------------

async function handleSignOut() {
  try {
    await signOut(auth);
    justPurchased = false;
    if (purchases) {
      // Reset to anonymous; the next sign-in will changeUser.
      configuredUid = null;
    }
  } catch (err) {
    console.error("[purchase] sign-out error", err);
  }
}

// ---------------------------------------------------------------------------
// Auth state observer
// ---------------------------------------------------------------------------

onAuthStateChanged(auth, (user) => {
  if (user) {
    resolveEntitlementState(user);
  } else {
    justPurchased = false;
    setMsg("signin-error", null);
    setMsg("signin-info", null);
    const signinBtn = el("btn-signin");
    if (signinBtn) signinBtn.disabled = false;
    const pwd = el("password");
    if (pwd) pwd.value = "";
    showView("signedOut");
  }
});

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

// Render now with the current language and re-render on every change driven by
// the shared header toggle. onChange invokes the callback immediately.
if (window.Gappon?.i18n) {
  window.Gappon.i18n.onChange(applyLang);
} else {
  applyLang(currentLang);
}

el("form-signin")?.addEventListener("submit", handleSignIn);
el("link-forgot")?.addEventListener("click", handleForgotPassword);
el("btn-purchase")?.addEventListener("click", handlePurchase);
el("btn-manage")?.addEventListener("click", handleManage);
document.querySelectorAll("[data-action='signout']").forEach((b) =>
  b.addEventListener("click", handleSignOut)
);

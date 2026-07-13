// Gappon web account page logic.
// Handles sign in, account creation, subscription purchase & status, and account
// settings (change email / change password) for a Firebase account. Premium is
// granted by attaching the annual `premium` entitlement to the signed-in Firebase
// UID via RevenueCat Web Billing (appUserId = UID). See Context Vault
// billing-plan.md / ADR-003..007.
//
// Every key in this file is a publishable public key (Firebase web config and the
// RevenueCat Web Billing public key), so it is safe to commit. Never place a secret key here.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
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
    title: "マイアカウント",
    lead:
      "Gappon Premium のご購入とアカウント管理ができます。ご購入後、同じアカウントでアプリにサインインすると全機能をご利用いただけます。",
    loading: "読み込み中…",
    promo_annual:
      "年額プランなら、月額プランよりお得にご利用いただけます。",
    label_username: "ユーザー名",
    label_email: "メールアドレス",
    label_email_confirm: "メールアドレス（確認のため再入力）",
    label_password: "パスワード",
    hint_password_policy: "6文字以上で、英字と数字をそれぞれ1文字以上含めてください。",
    hint_username_public: "ユーザー名は他の利用者に公開される場合があります。",
    tab_signin: "サインイン",
    tab_signup: "アカウント作成",
    btn_signin: "サインイン",
    btn_create: "アカウントを作成",
    link_forgot: "パスワードをお忘れの場合",
    note_signedout:
      "Gappon アプリまたはこのページで作成したアカウントでサインインしてください。",
    note_signup:
      "すでに Gappon アプリでアカウントをお持ちの場合は、新しく作成せず「サインイン」をご利用ください。二重に作成すると、ご購入が別のアカウントに紐づいてしまう場合があります。",
    signed_in_as: "サインイン中のアカウント",
    premium_title: "Gappon Premium",
    plan_name: "年額プラン",
    btn_purchase: "お支払いへ進む",
    btn_signout: "サインアウト",
    btn_account_settings: "アカウント設定",
    btn_manage: "サブスクリプションを管理",
    manage_note_appstore:
      "このサブスクリプションは App Store でご購入いただいたものです。変更・解約は端末の「設定」→ Apple ID →「サブスクリプション」から行えます。",
    manage_note_play:
      "このサブスクリプションは Google Play でご購入いただいたものです。変更・解約は Play ストアの「お支払いと定期購入」→「定期購入」から行えます。",
    manage_note_amazon:
      "このサブスクリプションは Amazon アプリストアでご購入いただいたものです。変更・解約は Amazon の「アプリライブラリ」→「サブスクリプション」から行えます。",
    store_name_appstore: "App Store",
    store_name_play: "Google Play",
    store_name_amazon: "Amazon アプリストア",
    manage_note_lifetime:
      "このご利用権は {store} での買い切り購入によるものです。ご購入内容は {store} のアカウントからご確認いただけます。",
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
    settings_title: "アカウント設定",
    section_change_username: "ユーザー名の変更",
    section_change_email: "メールアドレスの変更",
    section_change_password: "パスワードの変更",
    label_new_email: "新しいメールアドレス",
    label_new_password: "新しいパスワード",
    label_new_password_confirm: "新しいパスワード（確認）",
    btn_update_username: "ユーザー名を変更",
    btn_update_email: "メールアドレスを変更",
    btn_update_password: "パスワードを変更",
    btn_back: "戻る",
    reauth_title: "本人確認",
    reauth_body:
      "セキュリティのため、現在のパスワードをもう一度ご入力ください。",
    label_current_password: "現在のパスワード",
    aria_show_password: "パスワードを表示",
    aria_hide_password: "パスワードを非表示",
    btn_reauth_confirm: "確認",
    btn_cancel: "キャンセル",
    err_fill_username: "ユーザー名をご入力ください。",
    err_fill_credentials: "メールアドレスとパスワードをご入力ください。",
    err_invalid_email: "有効なメールアドレスをご入力ください。",
    err_invalid_credential: "メールアドレスまたはパスワードが正しくありません。",
    err_too_many: "試行回数が上限に達しました。しばらくしてからお試しください。",
    err_network: "ネットワークエラーが発生しました。接続をご確認のうえ、再度お試しください。",
    err_signin_generic: "サインインできませんでした。しばらくしてから再度お試しください。",
    err_fill_email_reset: "パスワードを再設定するメールアドレスをご入力ください。",
    info_reset_sent: "{email} 宛にパスワード再設定の手順をお送りしました。",
    err_email_mismatch: "メールアドレスが一致しません。もう一度ご確認ください。",
    err_email_in_use:
      "このメールアドレスはすでに使用されています。「サインイン」からお進みください。",
    err_weak_password: "パスワードは6文字以上でご設定ください。",
    err_password_policy: "パスワードは6文字以上で、英字と数字をそれぞれ1文字以上含めてください。",
    err_signup_generic: "アカウントを作成できませんでした。しばらくしてから再度お試しください。",
    info_signup_verify:
      "アカウントを作成しました。{email} 宛に確認メールをお送りしましたので、リンクからメールアドレスのご確認をおすすめします。",
    err_get_info: "サブスクリプション情報を取得できませんでした。しばらくしてから再度お試しください。",
    err_no_plan:
      "現在ご利用いただけるプランがありません。しばらくしてからお試しください。",
    err_purchase_start:
      "購入手続きを開始できませんでした。ページを再読み込みのうえ、再度お試しください。",
    err_purchase_pending:
      "お支払いを受け付けました。反映まで数分かかる場合があります。しばらくしてからアプリでご確認ください。",
    err_purchase_generic:
      "お支払いの処理中に問題が発生しました。しばらくしてから再度お試しください。",
    info_email_update_sent:
      "{email} 宛に確認メールをお送りしました。メール内のリンクを開くと、新しいメールアドレスへの変更が完了します。",
    err_email_update_generic:
      "メールアドレスを変更できませんでした。しばらくしてから再度お試しください。",
    err_fill_password: "パスワードをご入力ください。",
    err_password_mismatch: "パスワードが一致しません。もう一度ご確認ください。",
    info_password_updated: "パスワードを変更しました。",
    err_password_update_generic:
      "パスワードを変更できませんでした。しばらくしてから再度お試しください。",
    info_username_updated: "ユーザー名を変更しました。",
    err_username_update_generic:
      "ユーザー名を変更できませんでした。しばらくしてから再度お試しください。",
    err_reauth_failed: "パスワードが正しくありません。もう一度お試しください。",
  },
  en: {
    title: "My Account",
    lead:
      "Get Gappon Premium and manage your account here. After purchasing, sign in to the app with the same account to enjoy full access.",
    loading: "Loading…",
    promo_annual:
      "Choose the annual plan and pay less than you would month to month.",
    label_username: "Username",
    label_email: "Email",
    label_email_confirm: "Email (re-enter to confirm)",
    label_password: "Password",
    hint_password_policy: "Use at least 6 characters, including at least one letter and one number.",
    hint_username_public: "Your username may be visible to other people.",
    tab_signin: "Sign in",
    tab_signup: "Create account",
    btn_signin: "Sign in",
    btn_create: "Create account",
    link_forgot: "Forgot your password?",
    note_signedout:
      "Sign in with the account you created in the Gappon app or on this page.",
    note_signup:
      "If you already have an account in the Gappon app, please use \"Sign in\" instead of creating a new one. Creating a duplicate account may link your purchase to a different account.",
    signed_in_as: "Signed in as",
    premium_title: "Gappon Premium",
    plan_name: "Annual plan",
    btn_purchase: "Continue to payment",
    btn_signout: "Sign out",
    btn_account_settings: "Account settings",
    btn_manage: "Manage subscription",
    manage_note_appstore:
      "This subscription was purchased through the App Store. To change or cancel it, go to Settings → your Apple ID → Subscriptions on your device.",
    manage_note_play:
      "This subscription was purchased through Google Play. To change or cancel it, open the Play Store → Payments & subscriptions → Subscriptions.",
    manage_note_amazon:
      "This subscription was purchased through the Amazon Appstore. To change or cancel it, open Amazon → App Library → Subscriptions.",
    store_name_appstore: "the App Store",
    store_name_play: "Google Play",
    store_name_amazon: "the Amazon Appstore",
    manage_note_lifetime:
      "This access came from a one-time purchase on {store}. You can review it from your account on {store}.",
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
    settings_title: "Account settings",
    section_change_username: "Change username",
    section_change_email: "Change email",
    section_change_password: "Change password",
    label_new_email: "New email address",
    label_new_password: "New password",
    label_new_password_confirm: "New password (confirm)",
    btn_update_username: "Change username",
    btn_update_email: "Change email",
    btn_update_password: "Change password",
    btn_back: "Back",
    reauth_title: "Confirm it's you",
    reauth_body: "For your security, please enter your current password again.",
    label_current_password: "Current password",
    aria_show_password: "Show password",
    aria_hide_password: "Hide password",
    btn_reauth_confirm: "Confirm",
    btn_cancel: "Cancel",
    err_fill_username: "Please enter a username.",
    err_fill_credentials: "Please enter your email and password.",
    err_invalid_email: "Please enter a valid email address.",
    err_invalid_credential: "The email or password is incorrect.",
    err_too_many: "Too many attempts. Please try again later.",
    err_network: "A network error occurred. Please check your connection and try again.",
    err_signin_generic: "We couldn't sign you in. Please try again later.",
    err_fill_email_reset: "Please enter your email address to reset your password.",
    info_reset_sent: "We've sent password reset instructions to {email}.",
    err_email_mismatch: "The email addresses don't match. Please check and try again.",
    err_email_in_use: "This email is already in use. Please use \"Sign in\" instead.",
    err_weak_password: "Please use a password of at least 6 characters.",
    err_password_policy: "Your password must be at least 6 characters and include at least one letter and one number.",
    err_signup_generic: "We couldn't create your account. Please try again later.",
    info_signup_verify:
      "Your account was created. We've sent a verification email to {email} — we recommend confirming your address using the link.",
    err_get_info: "We couldn't load your subscription details. Please try again later.",
    err_no_plan: "No plan is available at the moment. Please try again later.",
    err_purchase_start: "We couldn't start the purchase. Please reload the page and try again.",
    err_purchase_pending:
      "Your payment was received. It may take a few minutes to activate — please check the app shortly.",
    err_purchase_generic: "Something went wrong during payment. Please try again later.",
    info_email_update_sent:
      "We've sent a verification email to {email}. Open the link in that email to complete the change to your new address.",
    err_email_update_generic:
      "We couldn't change your email. Please try again later.",
    err_fill_password: "Please enter a password.",
    err_password_mismatch: "The passwords don't match. Please check and try again.",
    info_password_updated: "Your password has been changed.",
    err_password_update_generic:
      "We couldn't change your password. Please try again later.",
    info_username_updated: "Your username has been changed.",
    err_username_update_generic:
      "We couldn't change your username. Please try again later.",
    err_reauth_failed: "That password is incorrect. Please try again.",
  },
};

// Language is owned by the shared site-wide runtime (assets/js/i18n.js), which
// handles detection, persistence, the header toggle, and <html lang>. This page
// keeps its own richer string table (I18N) for the account/billing-specific and
// dynamic copy, and re-renders it whenever the shared runtime reports a change.
let currentLang = window.Gappon?.i18n?.getLang?.() ?? "ja";

function t(key, params) {
  let s = I18N[currentLang]?.[key] ?? I18N.ja[key] ?? key;
  if (params) {
    // Replace every occurrence (split/join avoids regex escaping and handles a
    // placeholder that appears more than once, e.g. "{store} … {store}").
    for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(v);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
// Info message to surface on the signed-in view right after account creation.
let pendingSignedInInfo = null; // { key, params } | null
// The main view to return to when leaving account settings ("signedIn"|"active").
let settingsReturnView = "signedIn";
// A sensitive action awaiting re-authentication. { run, onSuccess, errNode, errKey }
let pendingSensitive = null;

const el = (id) => document.getElementById(id);
const views = {
  loading: el("view-loading"),
  signedOut: el("view-signed-out"),
  signedIn: el("view-signed-in"),
  active: el("view-active"),
  settings: el("view-settings"),
};

function showView(name) {
  Object.entries(views).forEach(([key, node]) => {
    if (node) node.hidden = key !== name;
  });
  // The account card (identity + settings + sign out) is a separate card shared
  // by the signed-in and active states, and hidden everywhere else.
  const accountCard = el("view-account");
  if (accountCard) accountCard.hidden = !(name === "signedIn" || name === "active");
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

// Decide how the active subscription can be managed, based on the store that
// unlocked it:
//   - Web Billing (rc_billing / stripe): show the "Manage subscription" button,
//     which opens the RevenueCat/Stripe customer portal (managementURL). This is
//     the only case where the subscription can actually be managed from the web.
//   - A mobile store (App Store / Play / Amazon): the subscription must be managed
//     in that store's own settings, not on the web, so show an explanatory note
//     instead of a (non-functional) button.
//   - A permanent/non-subscription entitlement (e.g. the legacy lifetime buy-out)
//     has nothing to manage: no button, no note.
function renderManageControls() {
  const btn = el("btn-manage");
  const store = activeEntitlement?.store || "";
  const url = activeEntitlement?.managementUrl || null;
  const webManaged = store === "rc_billing" || store === "stripe";
  const storeManaged =
    store === "app_store" ||
    store === "mac_app_store" ||
    store === "play_store" ||
    store === "amazon";
  // Only subscriptions (renewing, or cancelled-but-still-active until an expiry)
  // are worth pointing at store management; a lifetime buy-out has no expiry.
  const isSubscription =
    Boolean(activeEntitlement?.willRenew) || Boolean(activeEntitlement?.expirationDate);

  if (btn) btn.hidden = !(webManaged && url);

  if (storeManaged) {
    if (isSubscription) {
      // Renewing (or cancelled-but-active) store subscription: tell the user where
      // to change/cancel it, since that can only be done in the store.
      const key =
        store === "play_store"
          ? "manage_note_play"
          : store === "amazon"
          ? "manage_note_amazon"
          : "manage_note_appstore";
      setMsg("manage-store-note", key);
    } else {
      // Non-subscription store purchase (e.g. the legacy lifetime buy-out): nothing
      // to cancel, but note that it came from the store and where to review it.
      const nameKey =
        store === "play_store"
          ? "store_name_play"
          : store === "amazon"
          ? "store_name_amazon"
          : "store_name_appstore";
      setMsg("manage-store-note", "manage_note_lifetime", { store: t(nameKey) });
    }
  } else {
    setMsg("manage-store-note", null);
  }
}

// ---------------------------------------------------------------------------
// Apply language
// ---------------------------------------------------------------------------

function applyLang(lang) {
  currentLang = lang;
  auth.languageCode = lang; // Language for Firebase emails (e.g. verification, reset)

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
  renderManageControls();
  refreshPasswordToggles();
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
    el("settings-email").textContent = user.email || "";

    if (hasPremium(customerInfo)) {
      const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
      const rawExpiry = ent?.expirationDate ?? null;
      activeEntitlement = {
        expirationDate: rawExpiry ? new Date(rawExpiry) : null,
        willRenew: Boolean(ent?.willRenew),
        managementUrl: customerInfo.managementURL ?? null,
        // Store enum (purchases-js is lowercase): app_store | mac_app_store |
        // play_store | amazon | stripe | rc_billing | promotional | unknown.
        store: (ent?.store || "").toLowerCase(),
      };
      renderActiveExpiry();
      renderManageControls();
      const banner = el("active-banner");
      if (banner) banner.hidden = !justPurchased;
      settingsReturnView = "active";
      showView("active");
    } else {
      activeEntitlement = null;
      // Surface a one-time info message (e.g. "verification email sent") set
      // right after account creation.
      if (pendingSignedInInfo) {
        setMsg("signedin-info", pendingSignedInInfo.key, pendingSignedInInfo.params);
        pendingSignedInInfo = null;
      } else {
        setMsg("signedin-info", null);
      }
      await loadOfferingIntoUi(p);
      settingsReturnView = "signedIn";
      showView("signedIn");
    }
  } catch (err) {
    console.error("[account] failed to resolve entitlement", err);
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
// Auth tabs (sign in / create account)
// ---------------------------------------------------------------------------

function showAuthTab(tab) {
  const isSignup = tab === "signup";
  el("tab-signin").setAttribute("aria-selected", String(!isSignup));
  el("tab-signup").setAttribute("aria-selected", String(isSignup));
  el("form-signin").hidden = isSignup;
  el("form-signup").hidden = !isSignup;
  // Clear transient messages when switching tabs.
  setMsg("signin-error", null);
  setMsg("signin-info", null);
  setMsg("signup-error", null);
  setMsg("signup-info", null);
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
    console.error("[account] sign-in error", err);
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
// Event: create account
// ---------------------------------------------------------------------------

async function handleSignUp(event) {
  event.preventDefault();
  setMsg("signup-error", null);
  setMsg("signup-info", null);
  const username = el("signup-username").value.trim();
  const email = el("signup-email").value.trim();
  const emailConfirm = el("signup-email-confirm").value.trim();
  const password = el("signup-password").value;
  if (!username) {
    setMsg("signup-error", "err_fill_username");
    return;
  }
  if (!email || !password) {
    setMsg("signup-error", "err_fill_credentials");
    return;
  }
  // Sync check against typos: Web purchasers have no restore safety net, so a
  // mistyped email can permanently lock them out of their purchase.
  if (email.toLowerCase() !== emailConfirm.toLowerCase()) {
    setMsg("signup-error", "err_email_mismatch");
    return;
  }
  if (!meetsPasswordPolicy(password)) {
    setMsg("signup-error", "err_password_policy");
    return;
  }
  const btn = el("btn-create");
  btn.disabled = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Mirror the in-app registration so accounts created on the web are
    // consistent: the username is the account's display name (shown on the app's
    // Account screen) and is also stored on the users/{uid} document.
    try {
      await updateProfile(cred.user, { displayName: username });
      await setDoc(doc(db, "users", cred.user.uid), {
        username,
        createdAt: serverTimestamp(),
      });
    } catch (profileErr) {
      console.error("[account] profile/user-doc setup error", profileErr);
    }
    // Soft email verification: send the email but do not gate purchase on it, so
    // family members can buy immediately (e.g. on a limited P-Day).
    try {
      await sendEmailVerification(cred.user);
      pendingSignedInInfo = { key: "info_signup_verify", params: { email } };
    } catch (verifyErr) {
      console.error("[account] verification email error", verifyErr);
    }
    // onAuthStateChanged fires with the new user and renders the signed-in view.
  } catch (err) {
    console.error("[account] sign-up error", err);
    setMsg("signup-error", signUpErrorKey(err));
    btn.disabled = false;
  }
}

// Mirror the in-app registration policy (iOS RegistrationValidation /
// Android RegisterFragment): at least 6 characters, with at least one letter
// and one digit.
function meetsPasswordPolicy(pw) {
  return pw.length >= 6 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

function signUpErrorKey(err) {
  switch (err?.code) {
    case "auth/email-already-in-use":
      return "err_email_in_use";
    case "auth/invalid-email":
      return "err_invalid_email";
    case "auth/weak-password":
      return "err_weak_password";
    case "auth/network-request-failed":
      return "err_network";
    case "auth/too-many-requests":
      return "err_too_many";
    default:
      return "err_signup_generic";
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
    console.error("[account] password reset error", err);
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
    console.error("[account] purchase error", err);
    setMsg("purchase-error", "err_purchase_generic");
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Event: manage subscription (opens the RevenueCat/Stripe-hosted portal where
// the user can update payment, view billing history, or cancel — web purchases
// cannot be managed via the App Store / Play Store)
// ---------------------------------------------------------------------------

function handleManage() {
  const url = activeEntitlement?.managementUrl;
  if (!url) return;
  // Note: do NOT pass "noopener" as the window-features argument — some browsers
  // then treat this as a popup and the pop-up blocker silently swallows it
  // (window.open returns null, nothing happens). Open a normal tab and drop the
  // opener reference manually; fall back to same-tab navigation if it's blocked.
  const win = window.open(url, "_blank");
  if (win) {
    win.opener = null;
  } else {
    window.location.assign(url);
  }
}

// ---------------------------------------------------------------------------
// Account settings navigation
// ---------------------------------------------------------------------------

function openSettings() {
  // Reset settings forms/messages each time it's opened.
  el("form-change-username").reset();
  // Prefill with the current display name so it's clear what the username is now.
  el("new-username").value = auth.currentUser?.displayName || "";
  el("form-change-password").reset();
  setMsg("username-error", null);
  setMsg("username-info", null);
  setMsg("password-error", null);
  setMsg("password-info", null);
  resetPasswordVisibility();
  showView("settings");
}

function leaveSettings() {
  showView(settingsReturnView);
}

// ---------------------------------------------------------------------------
// Re-authentication (required by Firebase for sensitive operations)
// ---------------------------------------------------------------------------

// Runs a sensitive action; if Firebase requires a recent login, prompt for the
// password, re-authenticate, and retry. `onSuccess` is called on completion;
// errors are shown at `errNode` using the key returned by `errKeyFor(err)`.
async function runSensitive(run, onSuccess, errNode, errKeyFor) {
  try {
    await run();
    onSuccess();
  } catch (err) {
    if (err?.code === "auth/requires-recent-login") {
      pendingSensitive = { run, onSuccess, errNode, errKeyFor };
      openReauth();
      return;
    }
    console.error("[account] sensitive action error", err);
    setMsg(errNode, errKeyFor(err));
  }
}

function openReauth() {
  setMsg("reauth-error", null);
  el("reauth-password").value = "";
  el("reauth-modal").hidden = false;
  el("reauth-password").focus();
}

function closeReauth() {
  el("reauth-modal").hidden = true;
  pendingSensitive = null;
}

async function handleReauthConfirm(event) {
  event.preventDefault();
  setMsg("reauth-error", null);
  const user = auth.currentUser;
  const password = el("reauth-password").value;
  if (!user || !password) {
    setMsg("reauth-error", "err_fill_password");
    return;
  }
  const btn = el("btn-reauth-confirm");
  btn.disabled = true;
  try {
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
  } catch (err) {
    console.error("[account] reauth error", err);
    setMsg("reauth-error", "err_reauth_failed");
    btn.disabled = false;
    return;
  }
  const action = pendingSensitive;
  el("reauth-modal").hidden = true;
  pendingSensitive = null;
  btn.disabled = false;
  if (action) {
    try {
      await action.run();
      action.onSuccess();
    } catch (err) {
      console.error("[account] sensitive action error (post-reauth)", err);
      setMsg(action.errNode, action.errKeyFor(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Event: change username (display name)
// ---------------------------------------------------------------------------

// Username is a pure profile attribute: it does not affect the Firebase UID, the
// email login credential, or the RevenueCat entitlement, so (unlike email/password
// changes) it needs no re-authentication. It mirrors the in-app registration by
// writing both the Auth displayName and the users/{uid} document.
async function handleChangeUsername(event) {
  event.preventDefault();
  setMsg("username-error", null);
  setMsg("username-info", null);
  const user = auth.currentUser;
  const username = el("new-username").value.trim();
  if (!user) return;
  if (!username) {
    setMsg("username-error", "err_fill_username");
    return;
  }
  const btn = el("btn-update-username");
  btn.disabled = true;
  try {
    await updateProfile(user, { displayName: username });
    await setDoc(doc(db, "users", user.uid), { username }, { merge: true });
    setMsg("username-info", "info_username_updated");
  } catch (err) {
    console.error("[account] username update error", err);
    setMsg("username-error", "err_username_update_generic");
  }
  btn.disabled = false;
}

// ---------------------------------------------------------------------------
// Event: change email — deferred (see ADR-007). Kept for future restoration.
// Without a backend, a mistyped/unreachable new address can lock a web purchaser
// out of their account (no restore path), so email change is not offered on the
// web for now. Re-enable this handler, emailUpdateErrorKey, the HTML section, and
// the wiring together to bring it back.
// ---------------------------------------------------------------------------

// async function handleChangeEmail(event) {
//   event.preventDefault();
//   setMsg("email-error", null);
//   setMsg("email-info", null);
//   const user = auth.currentUser;
//   const newEmail = el("new-email").value.trim();
//   if (!user) return;
//   if (!newEmail) {
//     setMsg("email-error", "err_invalid_email");
//     return;
//   }
//   const btn = el("btn-update-email");
//   btn.disabled = true;
//   // verifyBeforeUpdateEmail sends a confirmation link to the NEW address; the
//   // change only takes effect once that link is opened. The Firebase UID (and thus
//   // the RevenueCat App User ID and the entitlement) is unaffected.
//   await runSensitive(
//     () => verifyBeforeUpdateEmail(user, newEmail),
//     () => {
//       setMsg("email-info", "info_email_update_sent", { email: newEmail });
//       el("new-email").value = "";
//     },
//     "email-error",
//     emailUpdateErrorKey
//   );
//   btn.disabled = false;
// }
//
// function emailUpdateErrorKey(err) {
//   switch (err?.code) {
//     case "auth/invalid-email":
//       return "err_invalid_email";
//     case "auth/email-already-in-use":
//       return "err_email_in_use";
//     case "auth/network-request-failed":
//       return "err_network";
//     default:
//       return "err_email_update_generic";
//   }
// }

// ---------------------------------------------------------------------------
// Event: change password
// ---------------------------------------------------------------------------

async function handleChangePassword(event) {
  event.preventDefault();
  setMsg("password-error", null);
  setMsg("password-info", null);
  const user = auth.currentUser;
  const pw = el("new-password").value;
  const pwConfirm = el("new-password-confirm").value;
  if (!user) return;
  if (!pw) {
    setMsg("password-error", "err_fill_password");
    return;
  }
  if (pw !== pwConfirm) {
    setMsg("password-error", "err_password_mismatch");
    return;
  }
  if (!meetsPasswordPolicy(pw)) {
    setMsg("password-error", "err_password_policy");
    return;
  }
  const btn = el("btn-update-password");
  btn.disabled = true;
  await runSensitive(
    () => updatePassword(user, pw),
    () => {
      setMsg("password-info", "info_password_updated");
      el("form-change-password").reset();
      resetPasswordVisibility();
    },
    "password-error",
    passwordUpdateErrorKey
  );
  btn.disabled = false;
}

function passwordUpdateErrorKey(err) {
  switch (err?.code) {
    case "auth/weak-password":
      return "err_weak_password";
    case "auth/network-request-failed":
      return "err_network";
    default:
      return "err_password_update_generic";
  }
}

// ---------------------------------------------------------------------------
// Event: sign out
// ---------------------------------------------------------------------------

async function handleSignOut() {
  try {
    await signOut(auth);
    justPurchased = false;
    pendingSignedInInfo = null;
    if (purchases) {
      // Reset to anonymous; the next sign-in will changeUser.
      configuredUid = null;
    }
  } catch (err) {
    console.error("[account] sign-out error", err);
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
    pendingSignedInInfo = null;
    setMsg("signin-error", null);
    setMsg("signin-info", null);
    setMsg("signup-error", null);
    setMsg("signup-info", null);
    const signinBtn = el("btn-signin");
    if (signinBtn) signinBtn.disabled = false;
    const createBtn = el("btn-create");
    if (createBtn) createBtn.disabled = false;
    const pwd = el("password");
    if (pwd) pwd.value = "";
    const signupPwd = el("signup-password");
    if (signupPwd) signupPwd.value = "";
    el("reauth-modal").hidden = true;
    pendingSensitive = null;
    resetPasswordVisibility();
    showAuthTab("signin");
    showView("signedOut");
  }
});

// ---------------------------------------------------------------------------
// Password show/hide toggles
// ---------------------------------------------------------------------------

function refreshPasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    const visible = btn.classList.contains("is-visible");
    btn.setAttribute("aria-label", t(visible ? "aria_hide_password" : "aria_show_password"));
  });
}

function handleTogglePassword(btn) {
  const input = btn.parentElement.querySelector("input");
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.classList.toggle("is-visible", show);
  btn.setAttribute("aria-label", t(show ? "aria_hide_password" : "aria_show_password"));
}

// Return all password fields to the masked state (e.g. on sign-out, or when
// opening/leaving account settings) so a revealed password is never left visible.
function resetPasswordVisibility() {
  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    const input = btn.parentElement.querySelector("input");
    if (input) input.type = "password";
    btn.classList.remove("is-visible");
    btn.setAttribute("aria-label", t("aria_show_password"));
  });
}

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

el("tab-signin")?.addEventListener("click", () => showAuthTab("signin"));
el("tab-signup")?.addEventListener("click", () => showAuthTab("signup"));
el("form-signin")?.addEventListener("submit", handleSignIn);
el("form-signup")?.addEventListener("submit", handleSignUp);
el("link-forgot")?.addEventListener("click", handleForgotPassword);
el("btn-purchase")?.addEventListener("click", handlePurchase);
el("btn-manage")?.addEventListener("click", handleManage);
el("form-change-username")?.addEventListener("submit", handleChangeUsername);
// el("form-change-email")?.addEventListener("submit", handleChangeEmail); // deferred (ADR-007)
el("form-change-password")?.addEventListener("submit", handleChangePassword);
el("form-reauth")?.addEventListener("submit", handleReauthConfirm);
document.querySelectorAll("[data-action='signout']").forEach((b) =>
  b.addEventListener("click", handleSignOut)
);
document.querySelectorAll("[data-action='settings']").forEach((b) =>
  b.addEventListener("click", openSettings)
);
document.querySelectorAll("[data-action='back']").forEach((b) =>
  b.addEventListener("click", leaveSettings)
);
document.querySelectorAll("[data-action='reauth-cancel']").forEach((b) =>
  b.addEventListener("click", closeReauth)
);
document.querySelectorAll("[data-toggle-password]").forEach((b) =>
  b.addEventListener("click", () => handleTogglePassword(b))
);

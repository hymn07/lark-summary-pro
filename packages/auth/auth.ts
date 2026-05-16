import { passkey } from "@better-auth/passkey";
import {
  db,
  getInvitationById,
  getPurchasesByOrganizationId,
  getPurchasesByUserId,
  getUserByEmail,
} from "@repo/database";
import type { Locale } from "@repo/i18n";
import { config as i18nConfig } from "@repo/i18n/config";
import { sendEmail } from "@repo/mail";
import { cancelSubscription } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  admin,
  createAuthMiddleware,
  emailOTP,
  openAPI,
  organization,
  twoFactor,
  username,
} from "better-auth/plugins";
import { parse as parseCookies } from "cookie";
import { config } from "./config";

const getLocaleFromRequest = (request?: Request) => {
  const cookies = parseCookies(request?.headers.get("cookie") ?? "");
  return (
    (cookies[i18nConfig.localeCookieName] as Locale) ??
    i18nConfig.defaultLocale
  );
};

const appUrl = getBaseUrl();

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [appUrl],
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  advanced: {
    database: {
      generateId: false,
    },
  },
  session: {
    expiresIn: config.sessionCookieMaxAge,
    freshAge: 0,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/organization/accept-invitation")) {
        const { invitationId } = ctx.body;
        if (!invitationId) return;
        const invitation = await getInvitationById(invitationId);
        if (!invitation) return;
        // 更新组织订阅席位
        try {
          await cancelSubscription("placeholder");
        } catch {
          // subscription management is optional
        }
      }
    }),
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path.startsWith("/delete-user") ||
        ctx.path.startsWith("/organization/delete")
      ) {
        const userId = ctx.context.session?.session.userId;
        const { organizationId } = ctx.body;
        if (userId || organizationId) {
          const purchases = organizationId
            ? await getPurchasesByOrganizationId(organizationId)
            : await getPurchasesByUserId(userId!);
          const subscriptions = purchases.filter(
            (p) => p.type === "SUBSCRIPTION" && p.subscriptionId !== null
          );
          for (const sub of subscriptions) {
            try {
              await cancelSubscription(sub.subscriptionId!);
            } catch {
              // subscription cancellation is optional
            }
          }
        }
      }
    }),
  },
  user: {
    additionalFields: {
      onboardingComplete: {
        type: "boolean",
        required: false,
      },
      locale: {
        type: "string",
        required: false,
      },
    },
    deleteUser: {
      enabled: true,
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async (
        { user: { email, name }, url },
        request
      ) => {
        const locale = getLocaleFromRequest(request);
        await sendEmail({
          to: email,
          templateId: "emailVerification",
          context: { url, name },
          locale,
        });
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: !config.enableSignup,
    requireEmailVerification: config.enableSignup,
    sendResetPassword: async ({ user, url }, request) => {
      const locale = getLocaleFromRequest(request);
      await sendEmail({
        to: user.email,
        templateId: "forgotPassword",
        context: { url, name: user.name },
        locale,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: config.enableSignup,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async (
      { user: { email, name }, url },
      request
    ) => {
      const locale = getLocaleFromRequest(request);
      await sendEmail({
        to: email,
        templateId: "emailVerification",
        context: { url, name },
        locale,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      scope: ["email", "profile"],
    },
  },
  plugins: [
    username(),
    admin(),
    passkey(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendEmail({
          to: email,
          templateId: "otpCode",
          context: { otp, type },
          locale: i18nConfig.defaultLocale as Locale,
        });
      },
      otpLength: 6,
      expiresIn: 300,
    }),
    organization({
      sendInvitationEmail: async (
        { email, id, organization },
        request
      ) => {
        const locale = getLocaleFromRequest(request);
        const existingUser = await getUserByEmail(email);
        const url = new URL(
          existingUser ? "/auth/login" : "/auth/signup",
          getBaseUrl()
        );
        url.searchParams.set("invitationId", id);
        url.searchParams.set("email", email);
        await sendEmail({
          to: email,
          templateId: "organizationInvitation",
          locale,
          context: {
            organizationName: organization.name,
            url: url.toString(),
          },
        });
      },
    }),
    openAPI(),
    twoFactor(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type ActiveOrganization = NonNullable<
  Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;
export type Organization = typeof auth.$Infer.Organization;
export type OrganizationMemberRole =
  ActiveOrganization["members"][number]["role"];
export type OrganizationInvitationStatus = typeof auth.$Infer.Invitation.status;
export type OrganizationMetadata = Record<string, unknown> | undefined;

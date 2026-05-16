import type { RouterClient } from "@orpc/server";
import { adminRouter } from "../modules/admin/router";
import { organizationsRouter } from "../modules/organizations/router";
import { paymentsRouter } from "../modules/payments/router";
import { usersRouter } from "../modules/users/router";
import { settingsRouter } from "../modules/settings/router";
import { promptVersionsRouter } from "../modules/prompt-versions/router";
import { meetingRecordsRouter } from "../modules/meeting-records/router";
import { adminMeetingRouter } from "../modules/admin-meeting/router";
import { publicProcedure } from "./procedures";

export const router = publicProcedure.router({
  admin: adminRouter,
  organizations: organizationsRouter,
  users: usersRouter,
  payments: paymentsRouter,
  settings: settingsRouter,
  prompts: promptVersionsRouter,
  meetings: meetingRecordsRouter,
  larkAdmin: adminMeetingRouter,
});

export type ApiRouterClient = RouterClient<typeof router>;

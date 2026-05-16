import { getSettings } from "./procedures/get-settings";
import { updateSettings } from "./procedures/update-settings";

export const settingsRouter = {
  get: getSettings,
  update: updateSettings,
};

import { getSettings } from "./procedures/get-settings";
import { updateSettings } from "./procedures/update-settings";
import { listFolders } from "./procedures/list-folders";

export const settingsRouter = {
  get: getSettings,
  update: updateSettings,
  listFolders,
};

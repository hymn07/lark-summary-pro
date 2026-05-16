import { listVersions } from "./procedures/list-versions";
import { createVersion } from "./procedures/create-version";
import { deleteVersion } from "./procedures/delete-version";
import { activateVersion } from "./procedures/activate-version";

export const promptVersionsRouter = {
  list: listVersions,
  create: createVersion,
  delete: deleteVersion,
  activate: activateVersion,
};

import { activateVersion } from "./procedures/activate-version";
import { createVersion } from "./procedures/create-version";
import { deleteVersion } from "./procedures/delete-version";
import { listVersions } from "./procedures/list-versions";
import { updateVersion } from "./procedures/update-version";

export const promptVersionsRouter = {
	list: listVersions,
	create: createVersion,
	update: updateVersion,
	delete: deleteVersion,
	activate: activateVersion,
};
